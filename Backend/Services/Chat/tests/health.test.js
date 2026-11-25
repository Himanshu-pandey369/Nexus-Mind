import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createHealthHandler } from "../../../Shared/middleware/healthCheck.js";
import { createInternalServiceAuth } from "../../../Shared/middleware/serviceAuth.js";

function dispatch(app, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const normalizedHeaders = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );

    const req = {
      method: "GET",
      url: path,
      originalUrl: path,
      headers: normalizedHeaders,
      get(name) {
        return normalizedHeaders[name.toLowerCase()];
      },
      header(name) {
        return normalizedHeaders[name.toLowerCase()];
      },
    };

    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return this.headers[name.toLowerCase()];
      },
      removeHeader(name) {
        delete this.headers[name.toLowerCase()];
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body });
        return this;
      },
      end(body) {
        resolve({ status: this.statusCode, body });
      },
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: 404, body: null });
    });
  });
}

describe("Chat Service /health endpoint", () => {
  const mockMongoose = { connection: { readyState: 1 } };
  let app;
  let savedSecret;

  before(() => {
    savedSecret = process.env.INTERNAL_SECRET;
    process.env.INTERNAL_SECRET = "test-internal-secret";

    app = express();
    app.get("/health", createHealthHandler("chat", mockMongoose));
    app.use(createInternalServiceAuth());
    app.get("/testing", (_req, res) => res.status(200).json("hello from chat"));
  });

  after(() => {
    if (savedSecret === undefined) {
      delete process.env.INTERNAL_SECRET;
    } else {
      process.env.INTERNAL_SECRET = savedSecret;
    }
  });

  it("returns 200 and connected when readyState is 1 without auth", async () => {
    mockMongoose.connection.readyState = 1;
    const res = await dispatch(app, "/health");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      status: "ok",
      service: "chat",
      database: "connected",
    });
  });

  it("returns 503 and disconnected when readyState is 0", async () => {
    mockMongoose.connection.readyState = 0;
    const res = await dispatch(app, "/health");
    assert.equal(res.status, 503);
    assert.deepEqual(res.body, {
      status: "error",
      service: "chat",
      database: "disconnected",
    });
  });

  it("returns 503 for other non-connected readyState values", async () => {
    for (const state of [2, 3, 99, undefined]) {
      mockMongoose.connection.readyState = state;
      const res = await dispatch(app, "/health");
      assert.equal(res.status, 503);
      assert.deepEqual(res.body, {
        status: "error",
        service: "chat",
        database: "disconnected",
      });
    }
  });

  it("keeps unrelated authenticated routes protected and functional", async () => {
    const unauth = await dispatch(app, "/testing");
    assert.equal(unauth.status, 403);

    const auth = await dispatch(app, "/testing", {
      "x-internal-secret": "test-internal-secret",
    });
    assert.equal(auth.status, 200);
    assert.equal(auth.body, "hello from chat");
  });
});
