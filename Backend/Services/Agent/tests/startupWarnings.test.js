import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { warnAgentStartupConfig } from "../config/startupWarnings.js";

describe("Agent Service startup configuration warnings", () => {
  it("warns for each missing optional integration without throwing", () => {
    const warnings = [];
    const logger = { warn: (msg) => warnings.push(msg) };

    assert.doesNotThrow(() => {
      warnAgentStartupConfig({ env: {}, logger });
    });

    assert.equal(warnings.length, 3);
    assert.match(warnings[0], /OpenRouter LLM/);
    assert.match(warnings[0], /OPENROUTER_API_KEY/);
    assert.match(warnings[1], /Google AI/);
    assert.match(warnings[1], /GOOGLE_API_KEY/);
    assert.match(warnings[2], /Qdrant Vector Store/);
    assert.match(warnings[2], /QDRANT_URL/);
    assert.match(warnings[2], /QDRANT_API_KEY/);
  });

  it("treats blank variables as missing and never logs configured secrets", () => {
    const warnings = [];
    const logger = { warn: (msg) => warnings.push(msg) };
    const openRouterSecret = "sk-or-secret-value-123";
    const qdrantUrl = "https://qdrant.example.internal:6333";

    warnAgentStartupConfig({
      env: {
        OPENROUTER_API_KEY: openRouterSecret,
        GOOGLE_API_KEY: "   ",
        QDRANT_URL: qdrantUrl,
        QDRANT_API_KEY: "",
      },
      logger,
    });

    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /GOOGLE_API_KEY/);
    assert.match(warnings[1], /QDRANT_API_KEY/);
    assert.doesNotMatch(warnings[1], /QDRANT_URL/);

    for (const msg of warnings) {
      assert.equal(msg.includes(openRouterSecret), false);
      assert.equal(msg.includes(qdrantUrl), false);
    }
  });

  it("emits no warnings when all Agent integration variables are configured", () => {
    const warnings = [];
    const logger = { warn: (msg) => warnings.push(msg) };

    warnAgentStartupConfig({
      env: {
        OPENROUTER_API_KEY: "or_key",
        GOOGLE_API_KEY: "google_key",
        QDRANT_URL: "https://qdrant.example.com",
        QDRANT_API_KEY: "qdrant_key",
      },
      logger,
    });

    assert.equal(warnings.length, 0);
  });
});
