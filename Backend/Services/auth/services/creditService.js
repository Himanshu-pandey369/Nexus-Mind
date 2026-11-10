import mongoose from "mongoose";
import User from "../models/user.model.js";
import CreditTransaction from "../models/creditTransaction.model.js";
import CreditReservation from "../models/creditReservation.model.js";
import redis from "../../../Shared/redis/redis.js";

/**
 * Synchronize Redis session credits for the given user ID (best-effort, non-blocking).
 * @param {string} userId
 * @param {number} newBalance
 */
async function syncUserRedisSession(userId, newBalance) {
  try {
    if (!redis) return;
    const targetId = userId.toString();
    const keys = await redis.keys("session-*");
    for (const key of keys) {
      const dataStr = await redis.get(key);
      if (dataStr) {
        try {
          const session = JSON.parse(dataStr);
          if (session.userID === targetId) {
            session.credits = newBalance;
            const ttl = await redis.ttl(key);
            if (ttl > 0) {
              await redis.set(key, JSON.stringify(session), "EX", ttl);
            } else {
              await redis.set(key, JSON.stringify(session));
            }
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn("[Credit Service] Redis session sync warning (non-fatal):", err.message);
  }
}

/**
 * Get authoritative credit balance from MongoDB.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function getCreditBalance(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID format");
  }

  const user = await User.findById(userId).select("credits").lean();
  if (!user) {
    throw new Error("User not found");
  }

  return user.credits ?? 0;
}

/**
 * Add credits to a user's account.
 * Idempotent: If referenceId was already processed for this user, returns existing balance and transaction.
 * Designed for future Razorpay webhook integration.
 *
 * @param {string} userId
 * @param {number} amount
 * @param {"FREE_ALLOCATION" | "AGENT_USAGE" | "PAYMENT" | "REFUND" | "ADMIN"} source
 * @param {string} [referenceId]
 * @param {string} [description]
 * @returns {Promise<{ balance: number, transaction: object }>}
 */
export async function addCredits(
  userId,
  amount,
  source = "PAYMENT",
  referenceId = "",
  description = ""
) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID format");
  }

  const creditAmount = Number(amount);
  if (isNaN(creditAmount) || creditAmount <= 0) {
    throw new Error("Credit amount must be a positive number");
  }

  // Idempotency check: prevent duplicate credit for the same payment/reference
  if (referenceId && referenceId.trim() !== "") {
    const existingTx = await CreditTransaction.findOne({
      userId,
      referenceId: referenceId.trim(),
    }).lean();

    if (existingTx) {
      const currentBalance = await getCreditBalance(userId);
      return {
        balance: currentBalance,
        transaction: existingTx,
        idempotent: true,
      };
    }
  }

  // Atomically increment balance
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: creditAmount } },
    { new: true, select: "credits" }
  );

  if (!updatedUser) {
    throw new Error("User not found");
  }

  const balanceAfter = updatedUser.credits;
  const balanceBefore = balanceAfter - creditAmount;

  // Record audit transaction
  const transaction = await CreditTransaction.create({
    userId,
    type: "CREDIT",
    amount: creditAmount,
    balanceBefore,
    balanceAfter,
    source,
    referenceId: referenceId ? referenceId.trim() : undefined,
    description: description || `Credits added via ${source}`,
  });

  // Sync Redis session immediately so gateway /me never returns stale credits
  try {
    await syncUserRedisSession(userId, balanceAfter);
  } catch (syncErr) {
    console.warn("[Credit Service] Redis session sync warning:", syncErr.message);
  }

  return {
    balance: balanceAfter,
    transaction,
  };
}

/**
 * Reserve credits before expensive agent execution.
 * Atomically checks available balance and decrements credits.
 * If balance is insufficient, no deduction occurs.
 *
 * @param {string} userId
 * @param {number} amount
 * @param {string} [description]
 * @returns {Promise<{ reservationId: string, balanceBefore: number, balanceAfter: number }>}
 */
export async function reserveCredits(userId, amount, description = "") {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID format");
  }

  const reserveAmount = Number(amount);
  if (isNaN(reserveAmount) || reserveAmount <= 0) {
    throw new Error("Reservation amount must be a positive number");
  }

  console.log(
    `[Credit Service] Reserve API called for user: ${userId}, requested amount: ${reserveAmount}`
  );

  // Atomic condition: only deduct if credits >= reserveAmount
  const user = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: reserveAmount } },
    { $inc: { credits: -reserveAmount } },
    { new: true, select: "credits" }
  );

  if (!user) {
    const existing = await User.findById(userId).select("credits").lean();
    if (!existing) {
      console.warn(`[Credit Service] User not found: ${userId}`);
      throw new Error("User not found");
    }
    console.warn(
      `[Credit Service] Insufficient credits for user ${userId}. Current balance: ${existing.credits}, required: ${reserveAmount}`
    );
    throw new Error("Insufficient credits");
  }

  const balanceAfter = user.credits;
  const balanceBefore = balanceAfter + reserveAmount;

  // Create reservation record
  const reservation = await CreditReservation.create({
    userId,
    amount: reserveAmount,
    status: "PENDING",
    description: description || "Agent execution reservation",
  });

  // Sync Redis session with reserved balance
  syncUserRedisSession(userId, balanceAfter).catch(() => {});

  console.log(
    `[Credit Service] Reservation created: ${reservation._id} for user ${userId}. Amount: ${reserveAmount}, balance before: ${balanceBefore}, balance after: ${balanceAfter}`
  );

  return {
    reservationId: reservation._id.toString(),
    balanceBefore,
    balanceAfter,
  };
}

/**
 * Commit a reservation after successful agent execution.
 * If actualAmount is less than reserved amount (e.g., auto router chose a cheaper agent),
 * the difference is automatically refunded to the user.
 *
 * @param {string} reservationId
 * @param {string} userId
 * @param {number} [actualAmount]
 * @param {string} [description]
 * @returns {Promise<{ balance: number, transaction: object, idempotent?: boolean }>}
 */
export async function commitCredits(
  reservationId,
  userId,
  actualAmount = null,
  description = ""
) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID format");
  }
  if (!mongoose.Types.ObjectId.isValid(reservationId)) {
    throw new Error("Invalid reservation ID format");
  }

  console.log(
    `[Credit Service] Commit API called for reservation: ${reservationId}, user: ${userId}, actualAmount: ${actualAmount}`
  );

  // Atomically claim the PENDING reservation to prevent concurrent double-commit/refund
  const reservation = await CreditReservation.findOneAndUpdate(
    {
      _id: reservationId,
      userId,
      status: "PENDING",
    },
    {
      $set: { status: "COMMITTED" },
    },
    { new: true }
  );

  if (!reservation) {
    // Check if this was already COMMITTED (idempotent retry protection)
    const existing = await CreditReservation.findOne({
      _id: reservationId,
      userId,
    }).lean();

    if (existing && existing.status === "COMMITTED") {
      const currentBalance = await getCreditBalance(userId);
      const existingTx = await CreditTransaction.findOne({
        referenceId: reservationId.toString(),
      }).lean();
      console.log(
        `[Credit Service] Reservation ${reservationId} already committed (idempotent retry). Current balance: ${currentBalance}`
      );
      return {
        balance: currentBalance,
        transaction: existingTx,
        idempotent: true,
      };
    }

    if (existing && existing.status === "REFUNDED") {
      console.warn(
        `[Credit Service] Cannot commit reservation ${reservationId}: already refunded`
      );
      throw new Error("Reservation has already been refunded");
    }

    throw new Error(
      "Reservation not found, already settled, or does not belong to this user"
    );
  }

  let finalDebitAmount = reservation.amount;
  let refundedDifference = 0;

  // If actual amount specified is less than reserved amount, refund the difference
  if (
    actualAmount !== null &&
    !isNaN(Number(actualAmount)) &&
    Number(actualAmount) > 0 &&
    Number(actualAmount) < reservation.amount
  ) {
    finalDebitAmount = Number(actualAmount);
    refundedDifference = reservation.amount - finalDebitAmount;

    await User.findByIdAndUpdate(userId, {
      $inc: { credits: refundedDifference },
    });
  } else if (
    actualAmount !== null &&
    !isNaN(Number(actualAmount)) &&
    Number(actualAmount) > reservation.amount
  ) {
    const extraDebit = Number(actualAmount) - reservation.amount;
    const debitedUser = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: extraDebit } },
      { $inc: { credits: -extraDebit } },
      { new: true, select: "credits" }
    );
    if (debitedUser) {
      finalDebitAmount = Number(actualAmount);
    }
  }

  const currentUser = await User.findById(userId).select("credits").lean();
  const balanceAfter = currentUser?.credits ?? 0;
  // Balance before deduction was current balance + what was deducted
  const balanceBefore = balanceAfter + finalDebitAmount;

  // Record DEBIT transaction
  const transaction = await CreditTransaction.create({
    userId,
    type: "DEBIT",
    amount: finalDebitAmount,
    balanceBefore,
    balanceAfter,
    source: "AGENT_USAGE",
    referenceId: reservation._id.toString(),
    description:
      description ||
      reservation.description ||
      `Agent usage debit: ${finalDebitAmount} credits`,
  });

  // Sync Redis session if Redis has active session for user
  syncUserRedisSession(userId, balanceAfter).catch(() => {});

  console.log(
    `[Credit Service] Reservation ${reservationId} committed successfully. Final debit: ${finalDebitAmount}, balance before: ${balanceBefore}, balance after: ${balanceAfter}`
  );

  return {
    balance: balanceAfter,
    transaction,
  };
}

/**
 * Refund a reserved credit amount when agent execution fails.
 * Returns credits to the user's balance and marks reservation as REFUNDED.
 *
 * @param {string} reservationId
 * @param {string} userId
 * @param {string} [description]
 * @returns {Promise<{ balance: number, transaction: object, idempotent?: boolean }>}
 */
export async function refundCredits(reservationId, userId, description = "") {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID format");
  }
  if (!mongoose.Types.ObjectId.isValid(reservationId)) {
    throw new Error("Invalid reservation ID format");
  }

  console.log(
    `[Credit Service] Refund API called for reservation: ${reservationId}, user: ${userId}, reason: ${description}`
  );

  // Atomically claim the PENDING reservation
  const reservation = await CreditReservation.findOneAndUpdate(
    {
      _id: reservationId,
      userId,
      status: "PENDING",
    },
    {
      $set: { status: "REFUNDED" },
    },
    { new: true }
  );

  if (!reservation) {
    // Check if this was already REFUNDED (idempotent retry protection)
    const existing = await CreditReservation.findOne({
      _id: reservationId,
      userId,
    }).lean();

    if (existing && existing.status === "REFUNDED") {
      const currentBalance = await getCreditBalance(userId);
      const existingTx = await CreditTransaction.findOne({
        referenceId: reservationId.toString(),
      }).lean();
      console.log(
        `[Credit Service] Reservation ${reservationId} already refunded (idempotent retry). Current balance: ${currentBalance}`
      );
      return {
        balance: currentBalance,
        transaction: existingTx,
        idempotent: true,
      };
    }

    if (existing && existing.status === "COMMITTED") {
      console.warn(
        `[Credit Service] Cannot refund reservation ${reservationId}: already committed`
      );
      throw new Error(
        "Reservation has already been committed and cannot be refunded"
      );
    }

    throw new Error(
      "Reservation not found, already settled, or does not belong to this user"
    );
  }

  // Atomically return reserved credits to user
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: reservation.amount } },
    { new: true, select: "credits" }
  );

  if (!updatedUser) {
    throw new Error("User not found");
  }

  const balanceAfter = updatedUser.credits;
  const balanceBefore = balanceAfter - reservation.amount;

  // Record REFUND transaction
  const transaction = await CreditTransaction.create({
    userId,
    type: "REFUND",
    amount: reservation.amount,
    balanceBefore,
    balanceAfter,
    source: "REFUND",
    referenceId: reservation._id.toString(),
    description:
      description ||
      `Refund for failed execution (reservation: ${reservation._id})`,
  });

  // Sync Redis session if Redis has active session for user
  syncUserRedisSession(userId, balanceAfter).catch(() => {});

  console.log(
    `[Credit Service] Reservation ${reservationId} refunded successfully. Amount refunded: ${reservation.amount}, balance before: ${balanceBefore}, balance after: ${balanceAfter}`
  );

  return {
    balance: balanceAfter,
    transaction,
  };
}

/**
 * Get paginated credit transactions for a user.
 *
 * @param {string} userId
 * @param {{ page?: number, limit?: number }} [options]
 * @returns {Promise<{ transactions: object[], total: number, page: number, totalPages: number }>}
 */
export async function getCreditTransactions(
  userId,
  { page = 1, limit = 20 } = {}
) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("Invalid user ID format");
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [transactions, total] = await Promise.all([
    CreditTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    CreditTransaction.countDocuments({ userId }),
  ]);

  return {
    transactions,
    total,
    page: safePage,
    totalPages: Math.ceil(total / safeLimit) || 1,
  };
}
