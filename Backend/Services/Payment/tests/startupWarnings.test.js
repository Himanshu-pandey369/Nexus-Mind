import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { warnPaymentStartupConfig } from "../config/startupWarnings.js";

describe("Payment Service startup configuration warnings", () => {
  it("warns when Razorpay variables are missing without throwing", () => {
    const warnings = [];
    const logger = { warn: (msg) => warnings.push(msg) };

    assert.doesNotThrow(() => {
      warnPaymentStartupConfig({ env: {}, logger });
    });

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Razorpay/);
    assert.match(warnings[0], /RAZORPAY_KEY_ID/);
    assert.match(warnings[0], /RAZORPAY_KEY_SECRET/);
  });

  it("treats blank or whitespace-only values as missing and never logs values", () => {
    const warnings = [];
    const logger = { warn: (msg) => warnings.push(msg) };
    const secretValue = "rzp_live_secret_do_not_log";

    warnPaymentStartupConfig({
      env: {
        RAZORPAY_KEY_ID: "   ",
        RAZORPAY_KEY_SECRET: secretValue,
      },
      logger,
    });

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /RAZORPAY_KEY_ID/);
    assert.doesNotMatch(warnings[0], /RAZORPAY_KEY_SECRET/);
    assert.equal(warnings[0].includes(secretValue), false);
  });

  it("emits no warnings when all Razorpay variables are configured", () => {
    const warnings = [];
    const logger = { warn: (msg) => warnings.push(msg) };

    warnPaymentStartupConfig({
      env: {
        RAZORPAY_KEY_ID: "rzp_test_123",
        RAZORPAY_KEY_SECRET: "rzp_secret_456",
      },
      logger,
    });

    assert.equal(warnings.length, 0);
  });
});
