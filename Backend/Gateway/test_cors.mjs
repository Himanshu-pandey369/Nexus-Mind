import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import express from "express";
import cors from "cors";
import { createCorsOptions, normalizeOrigin, parseAllowedOrigins } from "./config/cors.js";

const createTestApp = (corsConfig) => {
  const app = express();
  app.use(cors(createCorsOptions(corsConfig)));
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  app.post("/auth", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Not found" });
  });
  return app;
};

const invokeApp = (app, { method = "GET", url = "/health", headers = {} }) =>
  new Promise((resolve, reject) => {
    const normalizedHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = normalizedHeaders;
    req.connection = {};
    req.socket = {};

    const resHeaders = new Map();
    const chunks = [];
    const res = new EventEmitter();
    res.statusCode = 200;
    res.locals = {};
    res.headersSent = false;
    res.setHeader = (name, value) => {
      resHeaders.set(name.toLowerCase(), String(value));
    };
    res.getHeader = (name) => resHeaders.get(name.toLowerCase());
    res.removeHeader = (name) => resHeaders.delete(name.toLowerCase());
    res.hasHeader = (name) => resHeaders.has(name.toLowerCase());
    res.getHeaders = () => Object.fromEntries(resHeaders.entries());
    res.writeHead = (statusCode, headersArg) => {
      res.statusCode = statusCode;
      if (headersArg && typeof headersArg === "object") {
        for (const [k, v] of Object.entries(headersArg)) {
          res.setHeader(k, v);
        }
      }
      return res;
    };
    res.write = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    };
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      res.headersSent = true;
      resolve({
        status: res.statusCode,
        headers: {
          get: (name) => resHeaders.get(name.toLowerCase()) ?? null,
        },
        body: Buffer.concat(chunks).toString("utf8"),
      });
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
    });
  });

test("normalizeOrigin validates and normalizes origins safely", () => {
  assert.equal(normalizeOrigin("https://App.NexusMind.com/"), "https://app.nexusmind.com");
  assert.equal(normalizeOrigin("  http://localhost:5173/  "), "http://localhost:5173");
  assert.equal(normalizeOrigin("*"), null);
  assert.equal(normalizeOrigin("https://*.nexusmind.com"), null);
  assert.equal(normalizeOrigin("https://example.com/path"), null);
  assert.equal(normalizeOrigin("javascript:alert(1)"), null);
  assert.equal(normalizeOrigin(""), null);
});

test("parseAllowedOrigins ignores wildcards and invalid entries", () => {
  const origins = parseAllowedOrigins(
    "*, https://app.nexusmind.com/, not-a-url, https://admin.nexusmind.com",
    "production"
  );
  assert.deepEqual([...origins], ["https://app.nexusmind.com", "https://admin.nexusmind.com"]);
});

test("Production CORS with single configured origin", async () => {
  const app = createTestApp({
    frontendUrl: "https://app.nexusmind.com",
    nodeEnv: "production",
  });

  const allowedRes = await invokeApp(app, {
    url: "/health",
    headers: { Origin: "https://app.nexusmind.com" },
  });
  assert.equal(allowedRes.status, 200);
  assert.equal(allowedRes.headers.get("access-control-allow-origin"), "https://app.nexusmind.com");
  assert.equal(allowedRes.headers.get("access-control-allow-credentials"), "true");

  const evilRes = await invokeApp(app, {
    url: "/health",
    headers: { Origin: "https://evil-attacker.example.com" },
  });
  assert.equal(evilRes.headers.get("access-control-allow-origin"), null);
  assert.equal(evilRes.headers.get("access-control-allow-credentials"), null);
});

test("Production CORS with multiple comma-separated origins", async () => {
  const app = createTestApp({
    frontendUrl: "https://app.nexusmind.com/ , https://admin.nexusmind.com",
    nodeEnv: "production",
  });

  const first = await invokeApp(app, {
    url: "/health",
    headers: { Origin: "https://app.nexusmind.com" },
  });
  assert.equal(first.headers.get("access-control-allow-origin"), "https://app.nexusmind.com");
  assert.equal(first.headers.get("access-control-allow-credentials"), "true");

  const second = await invokeApp(app, {
    url: "/health",
    headers: { Origin: "https://admin.nexusmind.com" },
  });
  assert.equal(second.headers.get("access-control-allow-origin"), "https://admin.nexusmind.com");
  assert.equal(second.headers.get("access-control-allow-credentials"), "true");

  const unrelated = await invokeApp(app, {
    url: "/health",
    headers: { Origin: "https://unrelated-site.example.org" },
  });
  assert.equal(unrelated.headers.get("access-control-allow-origin"), null);
  assert.equal(unrelated.headers.get("access-control-allow-credentials"), null);
});

test("Empty FRONTEND_URL in production rejects all origins while preserving non-Origin requests", async () => {
  const app = createTestApp({
    frontendUrl: "",
    nodeEnv: "production",
  });

  const evilRes = await invokeApp(app, {
    url: "/health",
    headers: { Origin: "https://evil-attacker.example.com" },
  });
  assert.equal(evilRes.headers.get("access-control-allow-origin"), null);
  assert.equal(evilRes.headers.get("access-control-allow-credentials"), null);

  const localRes = await invokeApp(app, {
    url: "/health",
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(localRes.headers.get("access-control-allow-origin"), null);
  assert.equal(localRes.headers.get("access-control-allow-credentials"), null);

  // Server-to-server / CLI without Origin still succeeds
  const noOriginRes = await invokeApp(app, { url: "/health" });
  assert.equal(noOriginRes.status, 200);
  assert.equal(noOriginRes.headers.get("access-control-allow-origin"), null);
  assert.equal(noOriginRes.headers.get("access-control-allow-credentials"), null);
});

test("OPTIONS preflight from allowed and untrusted origins", async () => {
  const app = createTestApp({
    frontendUrl: "https://app.nexusmind.com",
    nodeEnv: "production",
  });

  const allowedPreflight = await invokeApp(app, {
    method: "OPTIONS",
    url: "/auth",
    headers: {
      Origin: "https://app.nexusmind.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type, Authorization",
    },
  });
  assert.equal(allowedPreflight.status, 204);
  assert.equal(allowedPreflight.headers.get("access-control-allow-origin"), "https://app.nexusmind.com");
  assert.equal(allowedPreflight.headers.get("access-control-allow-credentials"), "true");
  assert.ok(allowedPreflight.headers.get("access-control-allow-methods")?.includes("POST"));

  const evilPreflight = await invokeApp(app, {
    method: "OPTIONS",
    url: "/auth",
    headers: {
      Origin: "https://evil-attacker.example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type, Authorization",
    },
  });
  assert.equal(evilPreflight.headers.get("access-control-allow-origin"), null);
  assert.equal(evilPreflight.headers.get("access-control-allow-credentials"), null);
});

test("Local development preserves localhost access when FRONTEND_URL is unset while rejecting external origins", async () => {
  const app = createTestApp({
    frontendUrl: "",
    nodeEnv: "development",
  });

  const localRes = await invokeApp(app, {
    url: "/health",
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(localRes.status, 200);
  assert.equal(localRes.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(localRes.headers.get("access-control-allow-credentials"), "true");

  const evilRes = await invokeApp(app, {
    url: "/health",
    headers: { Origin: "https://evil-attacker.example.com" },
  });
  assert.equal(evilRes.headers.get("access-control-allow-origin"), null);
  assert.equal(evilRes.headers.get("access-control-allow-credentials"), null);
});
