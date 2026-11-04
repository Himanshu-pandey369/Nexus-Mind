import axios from "axios";

const getAuthServiceUrl = () =>
  process.env.AUTH_SERVICE_URL || "http://localhost:8001";

const getInternalHeaders = () => {
  const secret = process.env.INTERNAL_SECRET || "";
  const headers = { "Content-Type": "application/json" };
  if (secret) {
    headers["x-internal-secret"] = secret;
  }
  return headers;
};

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

