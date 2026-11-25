const isLocalDevOrigin = (normalizedOrigin) => {
  try {
    const parsed = new URL(normalizedOrigin);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
};

/**
 * Normalizes and validates a single HTTP/HTTPS origin string.
 * Returns the canonical origin (scheme + host + non-default port) or null if invalid.
 */
export const normalizeOrigin = (rawOrigin) => {
  if (typeof rawOrigin !== "string") {
    return null;
  }

  const trimmed = rawOrigin.trim();
  if (!trimmed || trimmed.includes("*")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

/**
 * Parses comma-separated FRONTEND_URL values into a Set of validated origins.
 */
export const parseAllowedOrigins = (frontendUrl, nodeEnv = process.env.NODE_ENV) => {
  const allowed = new Set();

  if (typeof frontendUrl === "string" && frontendUrl.trim() !== "") {
    for (const entry of frontendUrl.split(",")) {
      const normalized = normalizeOrigin(entry);
      if (normalized) {
        allowed.add(normalized);
      } else if (entry.trim()) {
        console.warn(`[Gateway CORS] Ignoring invalid configured origin: "${entry.trim()}"`);
      }
    }
  }

  if (nodeEnv === "production" && allowed.size === 0) {
    console.warn(
      "[Gateway CORS] FRONTEND_URL is missing or contains no valid origins in production; all cross-origin browser requests will be rejected."
    );
  }

  return allowed;
};

/**
 * Builds cors() middleware options enforcing an explicit origin allowlist in production.
 */
export const createCorsOptions = ({
  frontendUrl = process.env.FRONTEND_URL,
  nodeEnv = process.env.NODE_ENV,
} = {}) => {
  const allowedOrigins = parseAllowedOrigins(frontendUrl, nodeEnv);
  const isProduction = nodeEnv === "production";

  return {
    origin: (origin, callback) => {
      // Requests without an Origin header (e.g., server-to-server, curl, webhooks)
      // should proceed without emitting CORS allow-origin or credentials headers.
      if (!origin) {
        return callback(null, false);
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (!normalizedOrigin) {
        return callback(null, false);
      }

      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      // Preserve local development when FRONTEND_URL is not configured,
      // while still rejecting arbitrary non-local origins.
      if (!isProduction && allowedOrigins.size === 0 && isLocalDevOrigin(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  };
};
