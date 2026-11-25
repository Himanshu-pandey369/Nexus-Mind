import { warnMissingIntegrationConfig } from "../../../Shared/utils/startupWarnings.js";

export const PAYMENT_INTEGRATIONS = [
  {
    integration: "Razorpay",
    requiredVars: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  },
];

export function warnPaymentStartupConfig(options) {
  warnMissingIntegrationConfig("Payment", PAYMENT_INTEGRATIONS, options);
}
