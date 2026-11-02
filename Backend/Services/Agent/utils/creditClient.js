import axios from "axios";

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:8001";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "";

const getInternalHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  if (INTERNAL_SECRET) {
    headers["x-internal-secret"] = INTERNAL_SECRET;
  }
  return headers;
};

/**
 * Reserve credits before executing an agent.
 * @param {string} userId
 * @param {number} amount
 * @param {string} [description]
 * @returns {Promise<{ reservationId: string, balanceAfter: number }>}
 */
export async function reserveCredits(userId, amount, description = "") {
  const response = await axios.post(
    `${AUTH_SERVICE_URL}/auth/credits/reserve`,
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
  const response = await axios.post(
    `${AUTH_SERVICE_URL}/auth/credits/commit`,
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
  const response = await axios.post(
    `${AUTH_SERVICE_URL}/auth/credits/refund`,
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
    await axios.post(`${AUTH_SERVICE_URL}/auth/usage/record`, data, {
      headers: getInternalHeaders(),
    });
  } catch (err) {
    console.warn(
      `[Credit Client] Usage record logging failed (non-fatal): ${err.message}`
    );
  }
}
