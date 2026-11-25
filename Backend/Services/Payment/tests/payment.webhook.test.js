import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import axios from "axios";
import Payment from "../models/payment.model.js";
import { handleWebhook } from "../controllers/payment.controller.js";

function signPayload(rawBody, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("Payment Webhook Security (handleWebhook)", () => {
  let savedWebhookSecret;
  let savedKeySecret;
  let savedInternalSecret;
  let findOneMock;
  let axiosPostMock;
  let consoleLogMock;
  let consoleWarnMock;
  let consoleErrorMock;
  let logMessages;

  beforeEach(() => {
    savedWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    savedKeySecret = process.env.RAZORPAY_KEY_SECRET;
    savedInternalSecret = process.env.INTERNAL_SECRET;

    process.env.INTERNAL_SECRET = "test-internal-secret";

    logMessages = [];
    const capture = (...args) => {
      logMessages.push(args.map(String).join(" "));
    };

    consoleLogMock = mock.method(console, "log", capture);
    consoleWarnMock = mock.method(console, "warn", capture);
    consoleErrorMock = mock.method(console, "error", capture);

    findOneMock = mock.method(Payment, "findOne", async () => null);
    axiosPostMock = mock.method(axios, "post", async () => ({
      data: { balance: 150 },
    }));
  });

  afterEach(() => {
    mock.restoreAll();

    if (savedWebhookSecret === undefined) {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
    } else {
      process.env.RAZORPAY_WEBHOOK_SECRET = savedWebhookSecret;
    }

    if (savedKeySecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET = savedKeySecret;
    }

    if (savedInternalSecret === undefined) {
      delete process.env.INTERNAL_SECRET;
    } else {
      process.env.INTERNAL_SECRET = savedInternalSecret;
    }
  });

  it("verifies and processes event with correct webhook secret and valid signature", async () => {
    const webhookSecret = "whsec_test_valid_secret_123";
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
    delete process.env.RAZORPAY_KEY_SECRET;

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_123",
            order_id: "order_123",
            method: "upi",
          },
        },
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = signPayload(rawBody, webhookSecret);

    const saveMock = mock.fn(async function save() {
      return this;
    });
    const fakePayment = {
      userId: "user_1",
      razorpayOrderId: "order_123",
      credits: 100,
      bonusCredits: 20,
      status: "pending",
      save: saveMock,
    };

    findOneMock.mock.mockImplementation(async () => fakePayment);

    const req = {
      headers: { "x-razorpay-signature": signature },
      rawBody: Buffer.from(rawBody, "utf8"),
      body: payload,
    };
    const res = createMockRes();

    await handleWebhook(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      status: "ok",
      orderId: "order_123",
      fulfilled: true,
    });
    assert.equal(fakePayment.status, "fulfilled");
    assert.equal(fakePayment.razorpayPaymentId, "pay_123");
    assert.equal(fakePayment.paymentMethod, "upi");
    assert.equal(saveMock.mock.callCount(), 2);
    assert.equal(axiosPostMock.mock.callCount(), 1);
    assert.equal(
      logMessages.some((msg) => msg.includes(webhookSecret)),
      false
    );
  });

  it("rejects webhook when signature was signed with an incorrect webhook secret", async () => {
    const configuredSecret = "whsec_configured_secret";
    const wrongSecret = "whsec_wrong_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = configuredSecret;

    const payload = { event: "payment.captured", payload: {} };
    const rawBody = JSON.stringify(payload);
    const signature = signPayload(rawBody, wrongSecret);

    const req = {
      headers: { "x-razorpay-signature": signature },
      rawBody: Buffer.from(rawBody, "utf8"),
      body: payload,
    };
    const res = createMockRes();

    await handleWebhook(req, res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      success: false,
      message: "Invalid webhook signature",
    });
    assert.equal(findOneMock.mock.callCount(), 0);
    assert.equal(axiosPostMock.mock.callCount(), 0);
    assert.equal(
      logMessages.some(
        (msg) => msg.includes(configuredSecret) || msg.includes(wrongSecret)
      ),
      false
    );
  });

  it("fails safely when RAZORPAY_WEBHOOK_SECRET is missing", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_KEY_SECRET;

    const payload = { event: "payment.captured", payload: {} };
    const rawBody = JSON.stringify(payload);

    const req = {
      headers: { "x-razorpay-signature": "any_signature" },
      rawBody: Buffer.from(rawBody, "utf8"),
      body: payload,
    };
    const res = createMockRes();

    await handleWebhook(req, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
      success: false,
      message: "Webhook secret not configured",
    });
    assert.equal(findOneMock.mock.callCount(), 0);
    assert.equal(axiosPostMock.mock.callCount(), 0);
  });

  it("fails safely when RAZORPAY_KEY_SECRET is present but RAZORPAY_WEBHOOK_SECRET is missing", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const apiKeySecret = "rzp_key_secret_should_not_be_used";
    process.env.RAZORPAY_KEY_SECRET = apiKeySecret;

    const payload = {
      event: "payment.captured",
      payload: {
        payment: { entity: { id: "pay_123", order_id: "order_123" } },
      },
    };
    const rawBody = JSON.stringify(payload);
    // Attacker or misconfigured caller signs with RAZORPAY_KEY_SECRET
    const signatureSignedWithApiKey = signPayload(rawBody, apiKeySecret);

    const req = {
      headers: { "x-razorpay-signature": signatureSignedWithApiKey },
      rawBody: Buffer.from(rawBody, "utf8"),
      body: payload,
    };
    const res = createMockRes();

    await handleWebhook(req, res);

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
      success: false,
      message: "Webhook secret not configured",
    });
    assert.equal(findOneMock.mock.callCount(), 0);
    assert.equal(axiosPostMock.mock.callCount(), 0);
    assert.equal(
      JSON.stringify(res.body).includes(apiKeySecret),
      false
    );
    assert.equal(
      logMessages.some((msg) => msg.includes(apiKeySecret)),
      false
    );
  });

  it("rejects invalid, malformed, or missing signatures", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_valid_secret";
    const payload = { event: "payment.captured", payload: {} };
    const rawBody = JSON.stringify(payload);

    // 1. Missing signature header
    const resMissing = createMockRes();
    await handleWebhook(
      {
        headers: {},
        rawBody: Buffer.from(rawBody, "utf8"),
        body: payload,
      },
      resMissing
    );
    assert.equal(resMissing.statusCode, 400);
    assert.deepEqual(resMissing.body, {
      success: false,
      message: "Missing signature header",
    });

    // 2. Invalid hex signature of matching length
    const invalidHex = "0".repeat(64);
    const resInvalidHex = createMockRes();
    await handleWebhook(
      {
        headers: { "x-razorpay-signature": invalidHex },
        rawBody: Buffer.from(rawBody, "utf8"),
        body: payload,
      },
      resInvalidHex
    );
    assert.equal(resInvalidHex.statusCode, 400);
    assert.deepEqual(resInvalidHex.body, {
      success: false,
      message: "Invalid webhook signature",
    });

    // 3. Multi-byte UTF-8 signature with 64 JS characters (must not throw 500)
    const multiByteSig = "é".repeat(64);
    const resMultiByte = createMockRes();
    await handleWebhook(
      {
        headers: { "x-razorpay-signature": multiByteSig },
        rawBody: Buffer.from(rawBody, "utf8"),
        body: payload,
      },
      resMultiByte
    );
    assert.equal(resMultiByte.statusCode, 400);
    assert.deepEqual(resMultiByte.body, {
      success: false,
      message: "Invalid webhook signature",
    });

    assert.equal(findOneMock.mock.callCount(), 0);
  });

  it("preserves raw-body verification rather than re-serialized JSON body", async () => {
    const webhookSecret = "whsec_raw_body_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

    const payload = {
      event: "order.paid",
      payload: { order: { entity: { id: "order_raw_1" } } },
    };
    // Raw body has extra whitespace that JSON.stringify(payload) would strip
    const rawBodyWithWhitespace =
      '{  "event" : "order.paid" , "payload": { "order": { "entity": { "id": "order_raw_1" } } } }';

    // Signing re-serialized body must fail when rawBody differs
    const sigFromNormalized = signPayload(JSON.stringify(payload), webhookSecret);
    const resMismatch = createMockRes();
    await handleWebhook(
      {
        headers: { "x-razorpay-signature": sigFromNormalized },
        rawBody: Buffer.from(rawBodyWithWhitespace, "utf8"),
        body: payload,
      },
      resMismatch
    );
    assert.equal(resMismatch.statusCode, 400);

    // Signing exact rawBody must succeed
    const sigFromRaw = signPayload(rawBodyWithWhitespace, webhookSecret);
    const resMatch = createMockRes();
    await handleWebhook(
      {
        headers: { "x-razorpay-signature": sigFromRaw },
        rawBody: Buffer.from(rawBodyWithWhitespace, "utf8"),
        body: payload,
      },
      resMatch
    );
    assert.equal(resMatch.statusCode, 200);
    assert.equal(findOneMock.mock.callCount(), 1);
  });

  it("handles duplicate webhook events idempotently without re-crediting", async () => {
    const webhookSecret = "whsec_dup_secret";
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_dup_1",
            order_id: "order_dup_1",
            method: "card",
          },
        },
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = signPayload(rawBody, webhookSecret);

    const saveMock = mock.fn(async () => {});
    findOneMock.mock.mockImplementation(async () => ({
      userId: "user_dup",
      razorpayOrderId: "order_dup_1",
      credits: 100,
      bonusCredits: 0,
      status: "fulfilled",
      save: saveMock,
    }));

    const req = {
      headers: { "x-razorpay-signature": signature },
      rawBody: Buffer.from(rawBody, "utf8"),
      body: payload,
    };
    const res = createMockRes();

    await handleWebhook(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      status: "ok",
      message: "Already fulfilled",
    });
    assert.equal(saveMock.mock.callCount(), 0);
    assert.equal(axiosPostMock.mock.callCount(), 0);
  });
});
