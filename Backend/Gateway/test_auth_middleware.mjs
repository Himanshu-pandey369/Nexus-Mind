import test, { after } from "node:test";
import assert from "node:assert/strict";
import redis from "../Shared/redis/redis.js";
import { createAuthMiddleware } from "./middleware/auth.middle.js";

after(() => {
  redis.disconnect();
});

const createMockRes = () => {
  const res = {
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
  };
  return res;
};

test("1. Missing session cookie returns 401 and does not call next()", async () => {
  let nextCalled = false;
  let redisCalled = false;

  const middleware = createAuthMiddleware({
    status: "ready",
    get: async () => {
      redisCalled = true;
      return null;
    },
  });

  const req = { cookies: {} };
  const res = createMockRes();
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(redisCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    message: "Unauthorized: Please log in",
  });
});

test("2. Redis session key does not exist returns 401 and does not call next()", async () => {
  let nextCalled = false;

  const middleware = createAuthMiddleware({
    status: "ready",
    get: async (key) => {
      assert.equal(key, "session-missing-id");
      return null;
    },
  });

  const req = { cookies: { session: "missing-id" } };
  const res = createMockRes();
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    message: "Session expired or invalid",
  });
});

test("3. Valid Redis session attaches req.user and calls next()", async () => {
  let nextCalled = false;
  const userPayload = { userID: "u123", email: "user@example.com" };

  const middleware = createAuthMiddleware({
    status: "ready",
    get: async (key) => {
      assert.equal(key, "session-valid-id");
      return JSON.stringify(userPayload);
    },
  });

  const req = { cookies: { session: "valid-id" } };
  const res = createMockRes();
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, userPayload);
  assert.equal(res.statusCode, null);
});

test("4. Redis status is not ready returns 503 and does not call next() or get()", async () => {
  for (const status of ["connecting", "reconnecting", "close", "end", "wait"]) {
    let nextCalled = false;
    let getCalled = false;

    const middleware = createAuthMiddleware({
      status,
      get: async () => {
        getCalled = true;
        return null;
      },
    });

    const req = { cookies: { session: "valid-id" } };
    const res = createMockRes();
    await middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(getCalled, false);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, {
      success: false,
      message: "Authentication service temporarily unavailable. Please try again later.",
    });
  }
});

test("5. Redis get() throws ECONNREFUSED returns 503 and does not call next()", async () => {
  let nextCalled = false;

  const middleware = createAuthMiddleware({
    status: "ready",
    get: async () => {
      const err = new Error("connect ECONNREFUSED 127.0.0.1:6379");
      err.code = "ECONNREFUSED";
      throw err;
    },
  });

  const req = { cookies: { session: "valid-id" } };
  const res = createMockRes();
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    success: false,
    message: "Authentication service temporarily unavailable. Please try again later.",
  });
});

test("6. Redis get() throws timeout error returns 503 and does not call next()", async () => {
  let nextCalled = false;

  const middleware = createAuthMiddleware({
    status: "ready",
    get: async () => {
      throw new Error("Command timed out");
    },
  });

  const req = { cookies: { session: "valid-id" } };
  const res = createMockRes();
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    success: false,
    message: "Authentication service temporarily unavailable. Please try again later.",
  });
});

test("7. Unexpected non-Redis error returns 500 without calling next()", async () => {
  let nextCalled = false;

  const middleware = createAuthMiddleware({
    status: "ready",
    get: async () => "{invalid-json",
  });

  const req = { cookies: { session: "valid-id" } };
  const res = createMockRes();
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    success: false,
    message: "Internal server error",
  });
});

test("8. Unexpected non-connection error thrown from get() returns 500 without calling next()", async () => {
  let nextCalled = false;

  const middleware = createAuthMiddleware({
    status: "ready",
    get: async () => {
      throw new TypeError("Unexpected internal type mismatch");
    },
  });

  const req = { cookies: { session: "valid-id" } };
  const res = createMockRes();
  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    success: false,
    message: "Internal server error",
  });
});
