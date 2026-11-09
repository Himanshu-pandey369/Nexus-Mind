import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchCreditHistory } from "../redux/creditsSlice";
import getUserPlan from "../utils/userPlan";

function CoinsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-amber-400">
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

const PRICING_TIERS = [
  { name: "Starter", credits: 1000, price: "$5", popular: false },
  { name: "Pro", credits: 5000, price: "$20", popular: true },
  { name: "Enterprise", credits: 15000, price: "$50", popular: false },
];

export default function CreditModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const { balance, history, historyLoading } = useSelector(
    (state) => state.credits
  );
  const { userData } = useSelector((state) => state.user);
  const userPlan = getUserPlan(userData);

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchCreditHistory({ page: 1, limit: 15 }));
    }
  }, [isOpen, dispatch]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 md:p-6 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-modal-title"
    >
      <div
        className="relative w-full max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden my-auto min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-4 shrink-0 bg-slate-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <CoinsIcon />
            <h2 id="credit-modal-title" className="text-base font-semibold text-slate-100 truncate">
              Credits & Usage
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 min-w-0">
          {/* Current balance card */}
          <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 to-purple-950/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Current Available Balance
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {typeof balance === "number" ? balance.toLocaleString() : "..."}
                </span>
                <span className="text-xs text-indigo-300 font-medium">credits</span>
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                Active • {userPlan} Plan
              </span>
            </div>
          </div>

          {/* Top Up Credits Section */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-slate-200">
                Top Up Credits
              </h3>
              <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 whitespace-nowrap">
                Razorpay Checkout (Coming Soon)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              {PRICING_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`rounded-xl border p-4 sm:p-4 md:p-5 flex flex-col justify-between h-full min-w-0 transition ${
                    tier.popular
                      ? "border-indigo-500/60 bg-indigo-950/20 shadow-sm"
                      : "border-slate-800 bg-slate-950/50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                        {tier.name}
                      </h4>
                      {tier.popular && (
                        <span className="shrink-0 text-[9px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xl sm:text-2xl font-bold text-white flex items-baseline gap-1">
                      {tier.credits.toLocaleString()}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        credits
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">{tier.price}</p>
                  </div>

                  <button
                    disabled
                    type="button"
                    className="mt-4 w-full rounded-lg bg-slate-800 py-1.5 sm:py-2 text-xs font-medium text-slate-400 cursor-not-allowed hover:bg-slate-800 opacity-70 transition border border-slate-700/50"
                    title="Payment gateway will be integrated in future release"
                  >
                    Select Plan
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction History */}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Transaction History
            </h3>
            {historyLoading ? (
              <div className="flex items-center justify-center py-6 text-slate-400 text-xs">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-2" />
                Loading history...
              </div>
            ) : history.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-500">
                No transactions recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 min-w-0">
                <table className="w-full text-left text-xs min-w-[500px] sm:min-w-full border-collapse">
                  <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-3 sm:px-4 py-2.5 font-medium w-[15%]">Type</th>
                      <th className="px-3 sm:px-4 py-2.5 font-medium w-[15%]">Amount</th>
                      <th className="px-3 sm:px-4 py-2.5 font-medium w-[45%]">Description</th>
                      <th className="px-3 sm:px-4 py-2.5 font-medium w-[25%]">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {history.map((tx) => (
                      <tr key={tx._id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 sm:px-4 py-2.5">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              tx.type === "CREDIT"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : tx.type === "REFUND"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 font-mono">
                          {tx.type === "CREDIT" || tx.type === "REFUND"
                            ? `+${tx.amount}`
                            : `-${tx.amount}`}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-slate-300 break-words">
                          {tx.description || tx.source}
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-slate-400 whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
