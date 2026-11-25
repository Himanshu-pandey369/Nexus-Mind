import test from "node:test";
import assert from "node:assert/strict";
import connectDb, { createHealthHandler, sanitizeMongoError } from "./config/db.js";

const createMockRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test("1. Successful MongoDB connection resolves without error", async () => {
  let connectedUri = null;
  await connectDb({
    mongooseClient: {
      connect: async (uri) => {
        connectedUri = uri;
      },
    },
    env: {
      NODE_ENV: "production",
      AGENT_MONGODB_URI: "mongodb://127.0.0.1:27017/agent",
    },
  });

  assert.equal(connectedUri, "mongodb://127.0.0.1:27017/agent");
});

test("2. Missing MongoDB URI in production throws clear startup error", async () => {
  await assert.rejects(
    () =>
      connectDb({
        mongooseClient: { connect: async () => {} },
        env: { NODE_ENV: "production" },
      }),
    /AGENT_MONGODB_URI or MONGODB_URI must be defined in production/
  );
});

test("3. Missing MongoDB URI in local development warns and does not throw", async () => {
  let connectCalled = false;
  await connectDb({
    mongooseClient: {
      connect: async () => {
        connectCalled = true;
      },
    },
    env: { NODE_ENV: "development" },
  });

  assert.equal(connectCalled, false);
});

test("4. Initial MongoDB connection failure rethrows original error (not swallowed)", async () => {
  const originalErr = new Error(
    "connect ECONNREFUSED mongodb+srv://admin:supersecret@cluster0.example.com/agent"
  );

  await assert.rejects(
    () =>
      connectDb({
        mongooseClient: {
          connect: async () => {
            throw originalErr;
          },
        },
        env: {
          NODE_ENV: "production",
          MONGODB_URI: "mongodb+srv://admin:supersecret@cluster0.example.com/agent",
        },
      }),
    (err) => err === originalErr
  );
});

test("5. sanitizeMongoError redacts MongoDB credentials and URIs", () => {
  const redacted = sanitizeMongoError(
    new Error("Failed connecting to mongodb+srv://user:pass123@host.mongodb.net/nexus?retryWrites=true")
  );
  assert.equal(redacted, "Failed connecting to mongodb://<redacted>");
  assert.equal(redacted.includes("pass123"), false);
  assert.equal(redacted.includes("host.mongodb.net"), false);
});

test("6. Health endpoint returns 200 when connected and 503 when disconnected", () => {
  const mockMongoose = { connection: { readyState: 1 } };
  const healthHandler = createHealthHandler(mockMongoose);

  const okRes = createMockRes();
  healthHandler({}, okRes);
  assert.equal(okRes.statusCode, 200);
  assert.deepEqual(okRes.body, {
    status: "ok",
    service: "agent",
    database: "connected",
  });

  for (const disconnectedState of [0, 2, 3]) {
    mockMongoose.connection.readyState = disconnectedState;
    const downRes = createMockRes();
    healthHandler({}, downRes);
    assert.equal(downRes.statusCode, 503);
    assert.deepEqual(downRes.body, {
      status: "unhealthy",
      service: "agent",
      database: "disconnected",
    });
  }
});
