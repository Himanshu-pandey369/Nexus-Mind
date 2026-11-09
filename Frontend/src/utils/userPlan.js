/**
 * Safely extracts and formats the user's plan.
 * Falls back to "Free" if undefined, null, or unavailable.
 *
 * @param {Object|null|undefined} userData - The Redux user object
 * @returns {string} E.g., "Free", "Starter", "Pro", "Enterprise"
 */
export function getUserPlan(userData) {
  if (!userData) return "Free";
  const rawPlan = userData.plan || userData.subscriptionPlan || userData.tier;
  if (!rawPlan || typeof rawPlan !== "string") return "Free";
  const trimmed = rawPlan.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined"
  ) {
    return "Free";
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export default getUserPlan;
