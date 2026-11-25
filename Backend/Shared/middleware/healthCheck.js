/**
 * Creates an Express `/health` handler that reports MongoDB readiness.
 * Returns HTTP 200 when `mongooseClient.connection.readyState === 1`,
 * and HTTP 503 for any other connection state.
 */
export const createHealthHandler = (serviceName, mongooseClient) => (_req, res) => {
  const isConnected = mongooseClient?.connection?.readyState === 1;

  if (!isConnected) {
    return res.status(503).json({
      status: "error",
      service: serviceName,
      database: "disconnected",
    });
  }

  return res.status(200).json({
    status: "ok",
    service: serviceName,
    database: "connected",
  });
};
