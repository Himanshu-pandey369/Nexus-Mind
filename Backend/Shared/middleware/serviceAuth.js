import { timingSafeEqual } from "node:crypto";

export const getInternalServiceHeaders = () => {
  const secret = process.env.INTERNAL_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("INTERNAL_SECRET must be configured in production");
  }

  return secret ? { "x-internal-secret": secret } : {};
};

export const createInternalServiceAuth = () => {
  const headers = getInternalServiceHeaders();
  const expected = headers["x-internal-secret"];

  return (req, res, next) => {
    if (req.path === "/health" || !expected) {
      return next();
    }

    const supplied = Buffer.from(req.get("x-internal-secret") || "");
    const expectedBuffer = Buffer.from(expected);
    if (
      supplied.length !== expectedBuffer.length ||
      !timingSafeEqual(supplied, expectedBuffer)
    ) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: service authentication required",
      });
    }

    return next();
  };
};
