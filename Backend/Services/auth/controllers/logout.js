const isProduction = process.env.NODE_ENV === "production";

export const getSessionCookieOptions = (options = {}) => {
  const base = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
  if (process.env.COOKIE_DOMAIN) {
    base.domain = process.env.COOKIE_DOMAIN;
  }
  return {
    ...base,
    ...options,
  };
};

export const extractSessionId = (req) => {
  if (req.cookies?.session) {
    return req.cookies.session;
  }
  const cookieHeader = req.headers?.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
};

const isFirebaseAuthError = (error) => {
  const code = error?.code || error?.errorInfo?.code;
  return typeof code === "string" && code.startsWith("auth/");
};

/**
 * Factory for the logout controller, allowing dependency injection in tests
 * while preserving the production Redis and Firebase Admin instances.
 */
export const createLogoutHandler = ({ redisClient, getAuthFn, firebaseApp }) => {
  return async (req, res) => {
    try {
      const sessionID = extractSessionId(req);

      if (!sessionID) {
        res.clearCookie("session", getSessionCookieOptions());

        return res.status(200).json({
          success: true,
          message: "Logged out successfully",
        });
      }

      // Invalidate the server-side Redis session first; if this fails,
      // let the outer catch return 500 so we never report false success.
      await redisClient.del(`session-${sessionID}`);

      try {
        const auth = getAuthFn(firebaseApp);
        const decoded = await auth.verifySessionCookie(sessionID);
        if (decoded?.uid) {
          await auth.revokeRefreshTokens(decoded.uid);
        }
      } catch (firebaseError) {
        if (!isFirebaseAuthError(firebaseError)) {
          throw firebaseError;
        }
        const code = firebaseError.code || firebaseError.errorInfo?.code;
        console.warn(
          "Logout Firebase session verification/revocation skipped:",
          code || firebaseError.message
        );
      }

      res.clearCookie("session", getSessionCookieOptions());

      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error.message);

      res.clearCookie("session", getSessionCookieOptions());

      return res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  };
};
