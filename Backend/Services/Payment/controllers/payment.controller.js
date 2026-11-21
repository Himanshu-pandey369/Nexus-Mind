import crypto from "crypto";
import razorpayInstance from "../config/razorpay.js";
import { getPackageById, getAllPackages } from "../config/packages.js";
import Payment from "../models/payment.model.js";
import axios from "axios";
import { getInternalServiceHeaders } from "../../../Shared/middleware/serviceAuth.js";

const normalizeUrl = (url, fallback) => {
  const target = (url || "").trim();
  if (!target && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SERVICE_URL must be configured in production");
  }
  const resolved = target || fallback || "";
  const withProtocol = /^https?:\/\//i.test(resolved)
    ? resolved
    : `${process.env.NODE_ENV === "production" ? "https" : "http"}://${resolved}`;
  return withProtocol.replace(/\/+$/, "");
};

const AUTH_SERVICE_URL = normalizeUrl(process.env.AUTH_SERVICE_URL, "http://127.0.0.1:8001");

/**
 * Internal helper: call Auth Service to add credits.
 * Uses the existing `addCredits` function via the /credits/add endpoint.
 * Idempotent via referenceId (razorpayOrderId).
 */
async function fulfillCredits(userId, totalCredits, razorpayOrderId) {
  const response = await axios.post(
    `${AUTH_SERVICE_URL}/credits/add`,
    {
      userId,
      amount: totalCredits,
      source: "PAYMENT",
      referenceId: razorpayOrderId,
      description: `Credit purchase: ${totalCredits} credits (Order: ${razorpayOrderId})`,
    },
    {
      headers: {
        "Content-Type": "application/json",
        ...getInternalServiceHeaders(),
      },
      timeout: 120000,
    }
  );

  return response.data;
}

/**
 * GET /payment/packages
 * Returns available credit packages for display.
 */
export const getPackages = async (req, res) => {
  try {
    const packages = getAllPackages();
    return res.status(200).json({
      success: true,
      packages,
    });
  } catch (err) {
    console.error("[Payment Controller] getPackages error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch packages",
    });
  }
};

/**
 * POST /payment/create-order
 * Body: { packageId: string }
 * Creates a Razorpay order for the authenticated user.
 */
export const createOrder = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user identification",
      });
    }

    const { packageId } = req.body;
    if (!packageId || typeof packageId !== "string") {
      return res.status(400).json({
        success: false,
        message: "packageId is required",
      });
    }

    // Look up trusted package config — never trust frontend prices
    const pkg = getPackageById(packageId.trim());
    if (!pkg) {
      return res.status(400).json({
        success: false,
        message: `Invalid package: "${packageId}"`,
      });
    }

    // Amount in paise (Razorpay requires smallest currency unit)
    const amountInPaise = pkg.price * 100;
    const totalCredits = pkg.credits + pkg.bonusCredits;

    // Create Razorpay order
    const order = await razorpayInstance.orders.create({
      amount: amountInPaise,
      currency: pkg.currency,
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: {
        userId,
        packageId: pkg.id,
        credits: totalCredits.toString(),
      },
    });

    // Store pending payment record
    await Payment.create({
      userId,
      packageId: pkg.id,
      packageName: pkg.name,
      razorpayOrderId: order.id,
      amount: pkg.price,
      currency: pkg.currency,
      credits: pkg.credits,
      bonusCredits: pkg.bonusCredits,
      status: "pending",
    });

    console.log(
      `[Payment Controller] Order created: ${order.id} for user ${userId}, package: ${pkg.id}`
    );

    return res.status(201).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        packageName: pkg.name,
        credits: pkg.credits,
        bonusCredits: pkg.bonusCredits,
      },
      key: process.env.RAZORPAY_KEY_ID,  // Public key only — safe to send
    });
  } catch (err) {
    console.error("[Payment Controller] createOrder error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create payment order",
    });
  }
};

/**
 * POST /payment/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Verifies the payment signature and fulfills credits.
 */
export const verifyPayment = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user identification",
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message:
          "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
      });
    }

    // Find the pending payment record
    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found",
      });
    }

    // Verify order belongs to the authenticated user
    if (payment.userId !== userId) {
      console.warn(
        `[Payment Controller] User ${userId} attempted to verify order ${razorpay_order_id} belonging to user ${payment.userId}`
      );
      return res.status(403).json({
        success: false,
        message: "Forbidden: This order does not belong to you",
      });
    }

    // Idempotency: if already fulfilled, return success without re-crediting
    if (payment.status === "fulfilled") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified and credits fulfilled",
        payment: {
          orderId: payment.razorpayOrderId,
          credits: payment.credits + payment.bonusCredits,
          status: payment.status,
        },
      });
    }

    // If already verified but not fulfilled, skip signature check and retry fulfillment
    if (payment.status === "verified") {
      console.log(
        `[Payment Controller] Retrying fulfillment for verified order ${razorpay_order_id}`
      );
      return await attemptFulfillment(payment, userId, res);
    }

    // Only pending orders need signature verification
    if (payment.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Payment is in "${payment.status}" state and cannot be verified`,
      });
    }

    // Verify HMAC SHA-256 signature using timing-safe comparison
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isSignatureValid =
      generatedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(generatedSignature),
        Buffer.from(razorpay_signature)
      );

    if (!isSignatureValid) {
      // Mark payment as failed
      payment.status = "failed";
      payment.razorpayPaymentId = razorpay_payment_id;
      await payment.save();

      console.warn(
        `[Payment Controller] Invalid signature for order ${razorpay_order_id}`
      );

      return res.status(400).json({
        success: false,
        message: "Payment verification failed: Invalid signature",
      });
    }

    // Signature is valid — mark as verified first
    payment.status = "verified";
    payment.razorpayPaymentId = razorpay_payment_id;
    await payment.save();

    console.log(
      `[Payment Controller] Payment verified: ${razorpay_order_id}, paymentId: ${razorpay_payment_id}`
    );

    // Attempt credit fulfillment
    return await attemptFulfillment(payment, userId, res);
  } catch (err) {
    console.error("[Payment Controller] verifyPayment error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};

/**
 * Internal core: execute credit fulfillment for a verified payment.
 * Returns an object with the result rather than directly responding.
 */
async function processFulfillment(payment, userId) {
  const totalCredits = payment.credits + payment.bonusCredits;

  try {
    const result = await fulfillCredits(
      userId,
      totalCredits,
      payment.razorpayOrderId
    );

    // Mark as fulfilled
    payment.status = "fulfilled";
    payment.fulfillmentError = null;
    await payment.save();

    console.log(
      `[Payment Controller] Credits fulfilled: ${totalCredits} credits for user ${userId}, order ${payment.razorpayOrderId}`
    );

    return {
      success: true,
      credits: totalCredits,
      newBalance: result.balance,
    };
  } catch (fulfillErr) {
    // Keep status as "verified" so it can be safely retried
    payment.fulfillmentError = fulfillErr.message;
    await payment.save();

    console.error(
      `[Payment Controller] Credit fulfillment failed for order ${payment.razorpayOrderId}: ${fulfillErr.message}`
    );

    return {
      success: false,
      credits: totalCredits,
      error: fulfillErr.message,
    };
  }
}

/**
 * Internal helper: attempt to fulfill credits for a verified payment.
 * Sends appropriate HTTP response to caller.
 */
async function attemptFulfillment(payment, userId, res) {
  const result = await processFulfillment(payment, userId);

  if (result.success) {
    return res.status(200).json({
      success: true,
      message: "Payment verified and credits added successfully",
      payment: {
        orderId: payment.razorpayOrderId,
        credits: result.credits,
        status: "fulfilled",
        newBalance: result.newBalance,
      },
    });
  }

  return res.status(200).json({
    success: true,
    message:
      "Payment verified successfully but credit fulfillment is pending. Credits will be added shortly.",
    payment: {
      orderId: payment.razorpayOrderId,
      credits: result.credits,
      status: "verified",
    },
  });
}

/**
 * GET /payment/history
 * Returns sanitized payment history for the authenticated user.
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user identification",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments({ userId }),
    ]);

    const sanitizedPayments = payments.map((p) => {
      const pkg = getPackageById(p.packageId);
      return {
        id: p._id,
        orderId: p.razorpayOrderId,
        paymentId: p.razorpayPaymentId || null,
        packageId: p.packageId,
        packageName: p.packageName || pkg?.name || p.packageId,
        amount: p.amount,
        currency: p.currency || "INR",
        credits: p.credits + (p.bonusCredits || 0),
        baseCredits: p.credits,
        bonusCredits: p.bonusCredits || 0,
        status: p.status,
        paymentMethod: p.paymentMethod || null,
        createdAt: p.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      payments: sanitizedPayments,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("[Payment Controller] getPaymentHistory error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
    });
  }
};

/**
 * POST /payment/retry-fulfillment
 * Body: { orderId: string }
 * Retries credit fulfillment for a verified but unfulfilled payment.
 */
export const retryFulfillment = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user identification",
      });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required",
      });
    }

    const payment = await Payment.findOne({ razorpayOrderId: orderId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found",
      });
    }

    if (payment.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: This order does not belong to you",
      });
    }

    if (payment.status === "fulfilled") {
      return res.status(200).json({
        success: true,
        message: "Credits already fulfilled for this order",
        payment: {
          orderId: payment.razorpayOrderId,
          credits: payment.credits + payment.bonusCredits,
          status: payment.status,
        },
      });
    }

    if (payment.status !== "verified") {
      return res.status(400).json({
        success: false,
        message: `Cannot retry fulfillment: payment is in "${payment.status}" state`,
      });
    }

    return await attemptFulfillment(payment, userId, res);
  } catch (err) {
    console.error("[Payment Controller] retryFulfillment error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retry credit fulfillment",
    });
  }
};

/**
 * POST /payment/webhook
 * Razorpay Webhook Endpoint
 * Receives asynchronous server-to-server notifications from Razorpay.
 * Reconciles payments if the frontend closed or disconnected before verification.
 */
export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      console.warn("[Payment Webhook] Rejected: Missing x-razorpay-signature header");
      return res.status(400).json({
        success: false,
        message: "Missing signature header",
      });
    }

    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!webhookSecret) {
      console.error("[Payment Webhook] Webhook secret not configured on server");
      return res.status(500).json({
        success: false,
        message: "Webhook secret not configured",
      });
    }

    // Must verify against raw request body
    const rawBody = req.rawBody
      ? req.rawBody.toString("utf8")
      : (typeof req.body === "string" ? req.body : JSON.stringify(req.body));

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const isSignatureValid =
      expectedSignature.length === signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );

    if (!isSignatureValid) {
      console.warn("[Payment Webhook] Invalid webhook signature detected");
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // Signature verified — parse event safely
    const eventData = typeof req.body === "object" ? req.body : JSON.parse(rawBody);
    const { event, payload } = eventData;

    console.log(`[Payment Webhook] Verified event received: ${event}`);

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload?.payment?.entity;
      const orderEntity = payload?.order?.entity;
      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;
      const paymentMethod = paymentEntity?.method;

      if (!orderId) {
        console.warn("[Payment Webhook] Event missing order_id");
        return res.status(200).json({ status: "ignored", message: "No order ID found" });
      }

      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (!payment) {
        console.warn(`[Payment Webhook] Order ${orderId} not found in database`);
        return res.status(200).json({ status: "ignored", message: "Order not found" });
      }

      // Idempotency: Already fulfilled payments are not re-credited
      if (payment.status === "fulfilled") {
        console.log(`[Payment Webhook] Order ${orderId} already fulfilled. Skipping.`);
        return res.status(200).json({ status: "ok", message: "Already fulfilled" });
      }

      // Update payment record with gateway payment ID
      if (paymentId) payment.razorpayPaymentId = paymentId;
      if (paymentMethod) payment.paymentMethod = paymentMethod;
      payment.status = "verified";
      await payment.save();

      // Reconcile and fulfill credits
      const result = await processFulfillment(payment, payment.userId);
      if (result.success) {
        console.log(
          `[Payment Webhook] Reconciled and fulfilled credits for order ${orderId}`
        );
      } else {
        console.error(
          `[Payment Webhook] Fulfillment pending retry for order ${orderId}: ${result.error}`
        );
      }

      return res.status(200).json({
        status: "ok",
        orderId,
        fulfilled: result.success,
      });
    }

    if (event === "payment.failed") {
      const paymentEntity = payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const errorDescription =
        paymentEntity?.error_description || "Payment failed on Razorpay";

      if (orderId) {
        const payment = await Payment.findOne({ razorpayOrderId: orderId });
        if (payment && payment.status === "pending") {
          payment.status = "failed";
          if (paymentId) payment.razorpayPaymentId = paymentId;
          payment.fulfillmentError = errorDescription;
          await payment.save();
          console.log(
            `[Payment Webhook] Order ${orderId} marked failed: ${errorDescription}`
          );
        }
      }

      return res.status(200).json({ status: "ok" });
    }

    // Acknowledge other non-handled events with 200
    return res.status(200).json({ status: "ignored", event });
  } catch (err) {
    console.error("[Payment Webhook] Error processing webhook:", err.message);
    return res.status(500).json({
      success: false,
      message: "Webhook processing error",
    });
  }
};
