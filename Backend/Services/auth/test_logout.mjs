import test from "node:test";
import assert from "node:assert/strict";
import { createLogoutHandler, getSessionCookieOptions } from "./controllers/logout.js";

const createMockRes = () => {
  const res = {
    statusCode: null,
    body: null,
    clearedCookies: [],
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
      return this;
    },
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

const makeFirebaseError = (code, message) => {
  const err = new Error(message);
  err.code = code;
  return err;
};

test("Valid session logout deletes Redis key, revokes refresh tokens, clears cookie, returns 200", async () => {
  const deletedKeys = [];
  const revokedUids = [];

  const handler = createLogoutHandler({
    redisClient: {
      del: async (key) => {
        deletedKeys.push(key);
        return 1;
      },
    },
    getAuthFn: () => ({
      verifySessionCookie: async (sessionId) => {
        assert.equal(sessionId, "valid-session-123");
        return { uid: "firebase-uid-1" };
      },
      revokeRefreshTokens: async (uid) => {
        revokedUids.push(uid);
      },
    }),
    firebaseApp: {},
  });

  const req = { cookies: { session: "valid-session-123" }, headers: {} };
  const res = createMockRes();
  await handler(req, res);

  assert.deepEqual(deletedKeys, ["session-valid-session-123"]);
  assert.deepEqual(revokedUids, ["firebase-uid-1"]);
  assert.equal(res.clearedCookies.length, 1);
  assert.equal(res.clearedCookies[0].name, "session");
  assert.deepEqual(res.clearedCookies[0].options, getSessionCookieOptions());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: "Logged out successfully",
  });
});

test("Expired Firebase session cookie still deletes Redis key, clears cookie, and returns 200", async () => {
  const deletedKeys = [];
  let revokeCalled = false;

  const handler = createLogoutHandler({
    redisClient: {
      del: async (key) => {
        deletedKeys.push(key);
        return 1;
      },
    },
    getAuthFn: () => ({
      verifySessionCookie: async () => {
        throw makeFirebaseError("auth/session-cookie-expired", "Session cookie expired");
      },
      revokeRefreshTokens: async () => {
        revokeCalled = true;
      },
    }),
    firebaseApp: {},
  });

  const req = { headers: { cookie: "session=expired-session-1" } };
  const res = createMockRes();
  await handler(req, res);

  assert.deepEqual(deletedKeys, ["session-expired-session-1"]);
  assert.equal(revokeCalled, false);
  assert.equal(res.clearedCookies.length, 1);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: "Logged out successfully",
  });
});

test("Invalid Firebase session cookie still deletes Redis key, clears cookie, and returns 200", async () => {
  const deletedKeys = [];
  let revokeCalled = false;

  const handler = createLogoutHandler({
    redisClient: {
      del: async (key) => {
        deletedKeys.push(key);
        return 1;
      },
    },
    getAuthFn: () => ({
      verifySessionCookie: async () => {
        throw makeFirebaseError("auth/argument-error", "Decoding Firebase session cookie failed");
      },
      revokeRefreshTokens: async () => {
        revokeCalled = true;
      },
    }),
    firebaseApp: {},
  });

  const req = { cookies: { session: "not-a-valid-jwt" }, headers: {} };
  const res = createMockRes();
  await handler(req, res);

  assert.deepEqual(deletedKeys, ["session-not-a-valid-jwt"]);
  assert.equal(revokeCalled, false);
  assert.equal(res.clearedCookies.length, 1);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: "Logged out successfully",
  });
});

test("Revoked Firebase session cookie still deletes Redis key, clears cookie, and returns 200", async () => {
  const deletedKeys = [];
  let revokeCalled = false;

  const handler = createLogoutHandler({
    redisClient: {
      del: async (key) => {
        deletedKeys.push(key);
        return 1;
      },
    },
    getAuthFn: () => ({
      verifySessionCookie: async () => {
        throw makeFirebaseError("auth/session-cookie-revoked", "Session cookie has been revoked");
      },
      revokeRefreshTokens: async () => {
        revokeCalled = true;
      },
    }),
    firebaseApp: {},
  });

  const req = { cookies: { session: "revoked-session-1" }, headers: {} };
  const res = createMockRes();
  await handler(req, res);

  assert.deepEqual(deletedKeys, ["session-revoked-session-1"]);
  assert.equal(revokeCalled, false);
  assert.equal(res.clearedCookies.length, 1);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: "Logged out successfully",
  });
});

test("Missing session cookie clears cookie and returns 200 without calling Redis or Firebase", async () => {
  let redisCalled = false;
  let firebaseCalled = false;

  const handler = createLogoutHandler({
    redisClient: {
      del: async () => {
        redisCalled = true;
      },
    },
    getAuthFn: () => {
      firebaseCalled = true;
      return {};
    },
    firebaseApp: {},
  });

  const req = { cookies: {}, headers: {} };
  const res = createMockRes();
  await handler(req, res);

  assert.equal(redisCalled, false);
  assert.equal(firebaseCalled, false);
  assert.equal(res.clearedCookies.length, 1);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: "Logged out successfully",
  });
});

test("Redis session key already absent still succeeds with 200", async () => {
  const deletedKeys = [];
  const handler = createLogoutHandler({
    redisClient: {
      del: async (key) => {
        deletedKeys.push(key);
        return 0;
      },
    },
    getAuthFn: () => ({
      verifySessionCookie: async () => ({ uid: "firebase-uid-2" }),
      revokeRefreshTokens: async () => {},
    }),
    firebaseApp: {},
  });

  const req = { cookies: { session: "already-deleted-session" }, headers: {} };
  const res = createMockRes();
  await handler(req, res);

  assert.deepEqual(deletedKeys, ["session-already-deleted-session"]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: "Logged out successfully",
  });
});

test("Repeated logout requests are idempotent and return 200", async () => {
  const store = new Set(["session-repeat-1"]);
  let callCount = 0;

  const handler = createLogoutHandler({
    redisClient: {
      del: async (key) => (store.delete(key) ? 1 : 0),
    },
    getAuthFn: () => ({
      verifySessionCookie: async () => {
        callCount += 1;
        if (callCount === 1) return { uid: "firebase-uid-3" };
        throw makeFirebaseError("auth/session-cookie-revoked", "Already revoked");
      },
      revokeRefreshTokens: async () => {},
    }),
    firebaseApp: {},
  });

  const res1 = createMockRes();
  await handler({ cookies: { session: "repeat-1" }, headers: {} }, res1);
  assert.equal(res1.statusCode, 200);
  assert.deepEqual(res1.body, { success: true, message: "Logged out successfully" });

  const res2 = createMockRes();
  await handler({ cookies: { session: "repeat-1" }, headers: {} }, res2);
  assert.equal(res2.statusCode, 200);
  assert.deepEqual(res2.body, { success: true, message: "Logged out successfully" });
});

test("Redis unavailable during logout returns 500 and does not report success", async () => {
  let firebaseCalled = false;

  const handler = createLogoutHandler({
    redisClient: {
      del: async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:6379");
      },
    },
    getAuthFn: () => {
      firebaseCalled = true;
      return {};
    },
    firebaseApp: {},
  });

  const req = { cookies: { session: "valid-session-123" }, headers: {} };
  const res = createMockRes();
  await handler(req, res);

  assert.equal(firebaseCalled, false);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    success: false,
    message: "Logout failed",
  });
});
