import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchCreditBalance,
  fetchPaymentHistory,
  setCreditBalance,
} from "../redux/creditsSlice";
import { fetchCurrentUser } from "../redux/userSlice";
import getUserPlan from "../utils/userPlan";
import loadRazorpayScript from "../utils/loadRazorpay";
import api from "../../utils/axios";

function CoinsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-gold">
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="M16 12h1v4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-3 h-3 text-nm-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1zm3 8V5.5a3 3 0 1 0-6 0V9h6z" clipRule="evenodd" />
    </svg>
  );
}

const DEFAULT_PACKAGES = [
  {
    id: "starter",
    name: "Starter",
    price: 449,
    currency: "INR",
    credits: 1000,
    bonusCredits: 0,
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 1699,
    currency: "INR",
    credits: 5000,
    bonusCredits: 500,
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 3999,
    currency: "INR",
    credits: 15000,
    bonusCredits: 2000,
    popular: false,
  },
];

function formatPrice(price, currency = "INR") {
  if (currency === "INR") {
    return `₹${price.toLocaleString("en-IN")}`;
  }
  return `$${price.toLocaleString()}`;
}

export default function CreditModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const {
    balance,
    paymentHistory,
    paymentHistoryTotal,
    paymentHistoryPage,
    paymentHistoryTotalPages,
    paymentHistoryLoading,
    paymentHistoryError,
  } = useSelector((state) => state.credits);
  const { userData } = useSelector((state) => state.user);
  const userPlan = getUserPlan(userData);

  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [purchasingPackageId, setPurchasingPackageId] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [retryingFulfillment, setRetryingFulfillment] = useState(false);
  const [notice, setNotice] = useState(null);

  // Fetch balance, payment transaction history, user data, and dynamic packages on open
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchCreditBalance());
      dispatch(fetchCurrentUser());
      dispatch(fetchPaymentHistory({ page: 1, limit: 10 }));

      let isMounted = true;
      api
        .get("/payment/packages")
        .then((res) => {
          if (
            isMounted &&
            res.data?.success &&
            Array.isArray(res.data.packages) &&
            res.data.packages.length > 0
          ) {
            setPackages(res.data.packages);
          }
        })
        .catch(() => {
          // Fall back gracefully to DEFAULT_PACKAGES if packages endpoint fails
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, dispatch]);

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Retry credit fulfillment for a verified payment whose auth crediting was delayed
  const handleRetryFulfillment = async (orderId) => {
    setRetryingFulfillment(true);
    try {
      const res = await api.post("/payment/retry-fulfillment", { orderId });
      if (res.data?.success) {
        if (res.data.payment?.status === "fulfilled") {
          setNotice({
            type: "success",
            message: `Credits successfully fulfilled! ${res.data.payment.credits?.toLocaleString() || ""} credits added.`,
          });
          if (typeof res.data.payment?.newBalance === "number") {
            dispatch(setCreditBalance(res.data.payment.newBalance));
          }
          dispatch(fetchCreditBalance());
          dispatch(fetchCurrentUser());
          dispatch(fetchPaymentHistory({ page: paymentHistoryPage || 1, limit: 10 }));
        } else {
          setNotice({
            type: "warning",
            message: "Fulfillment is still processing. Please try again in a few seconds.",
            retryAction: {
              label: "Retry Again",
              onClick: () => handleRetryFulfillment(orderId),
            },
          });
        }
      } else {
        throw new Error(res.data?.message || "Failed to retry fulfillment");
      }
    } catch (err) {
      setNotice({
        type: "error",
        message: err.response?.data?.message || "Retry failed. Please check back shortly.",
        retryAction: {
          label: "Retry Again",
          onClick: () => handleRetryFulfillment(orderId),
        },
      });
    } finally {
      setRetryingFulfillment(false);
    }
  };

  // Verify payment with backend after Razorpay checkout returns success
  const verifyAndFulfillPayment = async (razorpayResponse, order) => {
    setVerifying(true);
    setNotice({
      type: "info",
      message: "Payment authorized! Verifying transaction with server...",
    });

    const payload = {
      razorpay_order_id: razorpayResponse.razorpay_order_id,
      razorpay_payment_id: razorpayResponse.razorpay_payment_id,
      razorpay_signature: razorpayResponse.razorpay_signature,
    };

    try {
      const res = await api.post("/payment/verify", payload);

      if (res.data?.success) {
        const paymentData = res.data.payment;
        const creditsAdded =
          paymentData?.credits || (order.credits + (order.bonusCredits || 0));

        if (
          paymentData?.status === "fulfilled" ||
          res.data.message?.includes("already verified")
        ) {
          // Successfully verified and fulfilled
          setNotice({
            type: "success",
            message: `Payment successful! ${creditsAdded.toLocaleString()} credits have been added to your balance.`,
          });

          // Optimistically update balance if returned
          if (typeof paymentData?.newBalance === "number") {
            dispatch(setCreditBalance(paymentData.newBalance));
          }

          // Refresh balance, session user data, and payment transaction history from authoritative source
          dispatch(fetchCreditBalance());
          dispatch(fetchCurrentUser());
          dispatch(fetchPaymentHistory({ page: 1, limit: 10 }));
        } else if (paymentData?.status === "verified") {
          // Signature valid, but auth service crediting is pending
          setNotice({
            type: "warning",
            message:
              "Payment verified successfully! Credit fulfillment is processing and will reflect shortly.",
            retryAction: {
              label: "Check Fulfillment",
              onClick: () => handleRetryFulfillment(payload.razorpay_order_id),
            },
          });

          // Schedule a delayed balance & user refresh
          setTimeout(() => {
            dispatch(fetchCreditBalance());
            dispatch(fetchCurrentUser());
            dispatch(fetchPaymentHistory({ page: 1, limit: 10 }));
          }, 3500);
        }
      } else {
        throw new Error(res.data?.message || "Payment verification failed.");
      }
    } catch (err) {
      console.error("[CreditModal] Verification error:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Payment was authorized on Razorpay, but verification could not be confirmed.";

      // Provide safe retry reconciliation without creating a new order
      setNotice({
        type: "error",
        message: `${errorMessage} Please retry verification to claim your credits.`,
        retryAction: {
          label: "Retry Verification",
          onClick: () => verifyAndFulfillPayment(razorpayResponse, order),
        },
      });
    } finally {
      setVerifying(false);
      setPurchasingPackageId(null);
    }
  };

  // Start purchase flow when user clicks a package button
  const handlePurchase = async (pkg) => {
    if (purchasingPackageId !== null || verifying) return;

    if (!userData) {
      setNotice({
        type: "error",
        message: "Please log in to purchase credits.",
      });
      return;
    }

    setPurchasingPackageId(pkg.id);
    setNotice(null);

    try {
      // 1. Dynamically load official Razorpay SDK
      try {
        await loadRazorpayScript();
      } catch (loadErr) {
        setPurchasingPackageId(null);
        setNotice({
          type: "error",
          message:
            loadErr.message ||
            "Failed to load Razorpay payment gateway script. Please check your internet or ad blocker.",
        });
        return;
      }

      // 2. Call Payment Service order creation API through Gateway
      const orderRes = await api.post("/payment/create-order", {
        packageId: pkg.id,
      });

      if (!orderRes.data?.success || !orderRes.data?.order) {
        throw new Error(orderRes.data?.message || "Failed to create payment order.");
      }

      const { order, key } = orderRes.data;
      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || key;

      if (!razorpayKey) {
        throw new Error("Razorpay public Key ID is missing from configuration.");
      }

      const totalCredits = (order.credits || 0) + (order.bonusCredits || 0);

      // 3. Configure Razorpay Standard Checkout options
      const options = {
        key: razorpayKey,
        amount: order.amount, // in paise
        currency: order.currency || "INR",
        name: "NexusMind",
        description: `${order.packageName || pkg.name} Plan (${totalCredits.toLocaleString()} credits)`,
        order_id: order.id,
        prefill: {
          name: userData?.name || "",
          email: userData?.email || "",
        },
        theme: {
          color: "#C6A66B",
        },
        modal: {
          ondismiss: () => {
            setPurchasingPackageId(null);
            setNotice({
              type: "info",
              message: "Checkout was closed. No payment was made.",
            });
          },
          escape: true,
          backdropclose: false,
        },
        handler: async (response) => {
          // Razorpay payment success callback
          await verifyAndFulfillPayment(response, order);
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (response) => {
        setPurchasingPackageId(null);
        const reason =
          response.error?.description ||
          response.error?.reason ||
          "Payment was declined or failed.";
        setNotice({
          type: "error",
          message: `Payment failed: ${reason}`,
        });
      });

      rzp.open();
    } catch (err) {
      console.error("[CreditModal] Order creation error:", err);
      setPurchasingPackageId(null);
      setNotice({
        type: "error",
        message:
          err.response?.data?.message ||
          err.message ||
          "Failed to initiate purchase. Please try again.",
      });
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 md:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-modal-title"
    >
      <div
        className="relative w-full max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-2xl border border-nm-border bg-nm-bg shadow-2xl overflow-hidden my-auto min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-nm-border-subtle px-4 sm:px-6 py-4 shrink-0 bg-nm-bg">
          <div className="flex items-center gap-2.5 min-w-0">
            <CoinsIcon />
            <h2 id="credit-modal-title" className="text-base font-semibold text-nm-text truncate">
              Credits & Usage
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-nm-text-muted hover:bg-nm-hover hover:text-nm-text transition focus:outline-none focus:ring-2 focus:ring-gold/50 shrink-0"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 min-w-0">
          {/* Current balance card */}
          <div className="rounded-xl border border-gold/30 bg-gradient-to-r from-gold-surface to-[#1A160F] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-nm-text-muted">
                Current Available Balance
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-nm-text tracking-tight">
                  {typeof balance === "number" ? balance.toLocaleString() : "..."}
                </span>
                <span className="text-xs text-gold font-medium">credits</span>
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              <span className="inline-flex items-center rounded-full bg-gold-surface px-3 py-1 text-xs font-medium text-gold border border-gold/30 whitespace-nowrap">
                Active • {userPlan} Plan
              </span>
            </div>
          </div>

          {/* Status / Alert Notification */}
          {notice && (
            <div
              className={`rounded-xl border p-3 sm:p-4 text-xs flex items-center justify-between gap-3 transition ${
                notice.type === "success"
                  ? "border-nm-success/30 bg-nm-success/10 text-nm-success"
                  : notice.type === "error"
                  ? "border-nm-error/30 bg-nm-error/10 text-nm-error"
                  : notice.type === "warning"
                  ? "border-nm-warning/30 bg-nm-warning/10 text-nm-warning"
                  : "border-gold/30 bg-gold-surface text-gold"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold shrink-0">
                  {notice.type === "success"
                    ? "✓"
                    : notice.type === "error"
                    ? "✗"
                    : notice.type === "warning"
                    ? "⚠"
                    : "ℹ"}
                </span>
                <span className="break-words">{notice.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {notice.retryAction && (
                  <button
                    type="button"
                    onClick={notice.retryAction.onClick}
                    disabled={verifying || retryingFulfillment}
                    className="rounded-lg bg-gold hover:bg-gold-hover px-3 py-1 text-xs font-semibold text-nm-sidebar transition disabled:opacity-50"
                  >
                    {retryingFulfillment ? "Processing..." : notice.retryAction.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="text-nm-text-muted hover:text-nm-text p-1"
                  aria-label="Dismiss notice"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
          )}

          {/* Top Up Credits Section */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-nm-text">
                Top Up Credits
              </h3>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-nm-success bg-nm-success/10 px-2.5 py-0.5 rounded-full border border-nm-success/20 whitespace-nowrap">
                <LockIcon />
                Secured by Razorpay
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              {packages.map((tier) => {
                const isThisPackageActive = purchasingPackageId === tier.id;
                const isAnyOperationActive = purchasingPackageId !== null || verifying;
                const totalCredits = tier.credits + (tier.bonusCredits || 0);

                return (
                  <div
                    key={tier.id || tier.name}
                    className={`rounded-xl border p-4 sm:p-4 md:p-5 flex flex-col justify-between h-full min-w-0 transition ${
                      tier.popular
                        ? "border-gold/40 bg-gold-surface shadow-sm"
                        : "border-nm-border bg-nm-secondary/60"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-nm-text truncate">
                          {tier.name}
                        </h4>
                        {tier.popular && (
                          <span className="shrink-0 text-[9px] uppercase font-bold text-gold bg-gold/15 px-1.5 py-0.5 rounded border border-gold/30">
                            Popular
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xl sm:text-2xl font-bold text-nm-text flex items-baseline gap-1">
                        {totalCredits.toLocaleString()}{" "}
                        <span className="text-xs font-normal text-nm-text-muted">
                          credits
                        </span>
                      </div>
                      {tier.bonusCredits > 0 ? (
                        <p className="text-[11px] text-gold font-medium mt-0.5">
                          +{tier.bonusCredits.toLocaleString()} bonus included
                        </p>
                      ) : (
                        <p className="text-[11px] text-nm-text-muted mt-0.5">
                          Standard package
                        </p>
                      )}
                      <p className="text-xs sm:text-sm font-semibold text-nm-text mt-2">
                        {formatPrice(tier.price, tier.currency)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePurchase(tier)}
                      disabled={isAnyOperationActive}
                      className={`mt-4 w-full rounded-lg py-1.5 sm:py-2 text-xs font-semibold transition flex items-center justify-center gap-2 border ${
                        isThisPackageActive
                          ? "bg-gold/80 text-nm-sidebar cursor-wait border-gold"
                          : isAnyOperationActive
                          ? "bg-nm-elevated text-nm-text-disabled cursor-not-allowed border-nm-border-subtle"
                          : tier.popular
                          ? "bg-gold hover:bg-gold-hover text-nm-sidebar font-semibold border-gold/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                          : "bg-nm-elevated hover:bg-nm-hover text-nm-text border-nm-border focus:outline-none focus:ring-2 focus:ring-gold/50"
                      }`}
                    >
                      {isThisPackageActive ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-nm-sidebar border-t-transparent" />
                          <span>{verifying ? "Verifying..." : "Opening..."}</span>
                        </>
                      ) : (
                        <span>Buy Now</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Transaction History */}
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-nm-text">
                Transaction History
              </h3>
              {paymentHistoryTotal > 0 && (
                <span className="text-[11px] text-nm-text-muted">
                  {paymentHistoryTotal} {paymentHistoryTotal === 1 ? "order" : "orders"}
                </span>
              )}
            </div>

            {/* Error state */}
            {paymentHistoryError ? (
              <div className="rounded-xl border border-nm-error/30 bg-nm-error/10 p-4 text-xs text-nm-error flex items-center justify-between gap-3">
                <span>Failed to load transaction history: {paymentHistoryError}</span>
                <button
                  type="button"
                  onClick={() => dispatch(fetchPaymentHistory({ page: paymentHistoryPage, limit: 10 }))}
                  className="rounded-lg bg-nm-error hover:bg-nm-error/85 px-3 py-1 font-semibold text-white transition shrink-0"
                >
                  Retry
                </button>
              </div>
            ) : paymentHistoryLoading ? (
              /* Loading state */
              <div className="flex items-center justify-center py-8 text-nm-text-muted text-xs">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gold border-t-transparent mr-2" />
                Loading transaction history...
              </div>
            ) : paymentHistory.length === 0 ? (
              /* Empty state */
              <div className="rounded-xl border border-nm-border bg-nm-secondary/40 py-8 text-center text-xs text-nm-text-muted">
                No payment transactions recorded yet.
              </div>
            ) : (
              /* Populated state */
              <div className="space-y-3 min-w-0">
                <div className="overflow-x-auto rounded-xl border border-nm-border bg-nm-secondary/40 min-w-0">
                  <table className="w-full text-left text-xs min-w-[540px] sm:min-w-full border-collapse">
                    <thead className="bg-nm-elevated text-nm-text-muted border-b border-nm-border">
                      <tr>
                        <th className="px-3 sm:px-4 py-2.5 font-medium">Package</th>
                        <th className="px-3 sm:px-4 py-2.5 font-medium">Amount</th>
                        <th className="px-3 sm:px-4 py-2.5 font-medium">Credits</th>
                        <th className="px-3 sm:px-4 py-2.5 font-medium">Status</th>
                        <th className="px-3 sm:px-4 py-2.5 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nm-border-subtle text-nm-text-secondary">
                      {paymentHistory.map((tx) => (
                        <tr key={tx.id || tx.orderId} className="hover:bg-nm-hover/40 transition-colors">
                          <td className="px-3 sm:px-4 py-2.5">
                            <span className="font-medium text-nm-text">
                              {tx.packageName || tx.packageId || "Credit Top-Up"}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 font-mono text-nm-text">
                            {formatPrice(tx.amount, tx.currency)}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 font-mono text-gold">
                            +{tx.credits?.toLocaleString() || "0"}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                tx.status === "fulfilled"
                                  ? "bg-nm-success/10 text-nm-success border-nm-success/20"
                                  : tx.status === "verified"
                                  ? "bg-gold/10 text-gold border-gold/20"
                                  : tx.status === "failed"
                                  ? "bg-nm-error/10 text-nm-error border-nm-error/20"
                                  : "bg-nm-elevated text-nm-text-muted border-nm-border"
                              }`}
                            >
                              {tx.status?.toUpperCase() || "PENDING"}
                            </span>
                            {tx.status === "verified" && (
                              <button
                                type="button"
                                onClick={() => handleRetryFulfillment(tx.orderId)}
                                disabled={retryingFulfillment}
                                className="ml-2 underline text-[10px] text-gold hover:text-gold-light disabled:opacity-50"
                              >
                                Claim
                              </button>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 text-nm-text-muted whitespace-nowrap">
                            {tx.createdAt
                              ? new Date(tx.createdAt).toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination controls */}
                {paymentHistoryTotalPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-nm-text-muted px-1 pt-1">
                    <span>
                      Page {paymentHistoryPage} of {paymentHistoryTotalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch(
                            fetchPaymentHistory({
                              page: Math.max(1, paymentHistoryPage - 1),
                              limit: 10,
                            })
                          )
                        }
                        disabled={paymentHistoryPage <= 1 || paymentHistoryLoading}
                        className="rounded-lg border border-nm-border bg-nm-elevated px-2.5 py-1 text-nm-text-secondary hover:bg-nm-hover hover:text-nm-text disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          dispatch(
                            fetchPaymentHistory({
                              page: Math.min(
                                paymentHistoryTotalPages,
                                paymentHistoryPage + 1
                              ),
                              limit: 10,
                            })
                          )
                        }
                        disabled={
                          paymentHistoryPage >= paymentHistoryTotalPages ||
                          paymentHistoryLoading
                        }
                        className="rounded-lg border border-nm-border bg-nm-elevated px-2.5 py-1 text-nm-text-secondary hover:bg-nm-hover hover:text-nm-text disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
