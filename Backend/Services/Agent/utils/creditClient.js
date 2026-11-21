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

const getAuthServiceUrl = () =>
  normalizeUrl(process.env.AUTH_SERVICE_URL, "http://127.0.0.1:8001");

const getInternalHeaders = () => ({
  "Content-Type": "application/json",
  ...getInternalServiceHeaders(),
});

/**
 * Reserve credits before executing an agent.
 * @param {string} userId
 * @param {number} amount
 * @param {string} [description]
 * @returns {Promise<{ reservationId: string, balanceBefore?: number, balanceAfter: number }>}
 */
export async function reserveCredits(userId, amount, description = "") {
  const url = `${getAuthServiceUrl()}/auth/credits/reserve`;
  console.log(
    `[Credit Client] Calling reserveCredits at ${url} for userId: ${userId}, amount: ${amount}`
  );

  const response = await axios.post(
    url,
    { userId, amount, description },
    { headers: getInternalHeaders() }
  );

  return response.data;
}

/**
 * Commit reservation on successful execution.
 * @param {string} reservationId
 * @param {string} userId
 * @param {number} [actualAmount]
 * @param {string} [description]
 * @returns {Promise<{ balance: number, transaction: object }>}
 */
export async function commitCredits(
  reservationId,
  userId,
  actualAmount = null,
  description = ""
) {
  const url = `${getAuthServiceUrl()}/auth/credits/commit`;
  console.log(
    `[Credit Client] Calling commitCredits at ${url} for reservationId: ${reservationId}, userId: ${userId}, actualAmount: ${actualAmount}`
  );

  const response = await axios.post(
    url,
    { reservationId, userId, actualAmount, description },
    { headers: getInternalHeaders() }
  );

  return response.data;
}

/**
 * Refund reservation on failed execution.
 * @param {string} reservationId
 * @param {string} userId
 * @param {string} [description]
 * @returns {Promise<{ balance: number, transaction: object }>}
 */
export async function refundCredits(reservationId, userId, description = "") {
  const url = `${getAuthServiceUrl()}/auth/credits/refund`;
  console.log(
    `[Credit Client] Calling refundCredits at ${url} for reservationId: ${reservationId}, userId: ${userId}`
  );

  const response = await axios.post(
    url,
    { reservationId, userId, description },
    { headers: getInternalHeaders() }
  );

  return response.data;
}

/**
 * Record LLM token usage. Non-fatal: failures are caught and logged.
 * @param {{
 *   userId: string,
 *   conversationId?: string,
 *   agent: string,
 *   model?: string,
 *   inputTokens?: number,
 *   outputTokens?: number,
 *   totalTokens?: number,
 *   estimatedCost?: number,
 *   currency?: string
 * }} data
 */
export async function recordUsage(data) {
  try {
    const url = `${getAuthServiceUrl()}/auth/usage/record`;
    await axios.post(url, data, {
      headers: getInternalHeaders(),
    });
  } catch (err) {
    console.warn(
      `[Credit Client] Usage record logging failed (non-fatal): ${err.message}`
    );
  }
}

