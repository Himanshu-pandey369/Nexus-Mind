/**
 * Checks expected integration environment variables once at startup
 * and logs non-blocking warnings for any missing or blank values.
 * Never logs actual values, credentials, or secrets.
 */
export function warnMissingIntegrationConfig(
  serviceName,
  integrations,
  { env = process.env, logger = console } = {}
) {
  for (const { integration, requiredVars } of integrations) {
    const missingVars = requiredVars.filter((varName) => {
      const value = env[varName];
      return typeof value !== "string" || value.trim().length === 0;
    });

    if (missingVars.length > 0) {
      logger.warn(
        `[${serviceName}] Startup configuration warning: ${integration} is missing ${missingVars.join(
          ", "
        )}. Related features will be unavailable until configured.`
      );
    }
  }
}
