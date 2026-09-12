import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBoard } from "../src/lib/openai";
import { fallbackAnalysis } from "../src/lib/fallback";
import {
  initialPlayers,
  scenarios,
  type AnalysisRequest,
} from "../src/lib/tactics";

const input: AnalysisRequest = {
  scenario: "press",
  question: "How do we beat this press?",
  userFormation: scenarios.press.userFormation,
  opponentFormation: scenarios.press.opponentFormation,
  players: initialPlayers("press"),
};
const fixture = fallbackAnalysis("press", input.players);
const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const restore = () => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
};
function mockResponse(analysis: unknown, status = "completed") {
  return new Response(
    JSON.stringify({
      id: "resp_fixture",
      object: "response",
      created_at: 1,
      status,
      output: [
        {
          type: "message",
          id: "msg_fixture",
          status: "completed",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(analysis),
              annotations: [],
            },
          ],
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
test("server uses the real SDK Responses parser and sends a strict schema", async () => {
  process.env.OPENAI_API_KEY = "test-placeholder-not-a-real-key";
  let called = false;
  globalThis.fetch = async (_url, options) => {
    called = true;
    const payload = JSON.parse(String(options?.body));
    assert.equal(payload.text.format.type, "json_schema");
    assert.equal(payload.text.format.strict, true);
    assert.equal(payload.store, false);
    assert.equal(JSON.parse(payload.input).players.length, 22);
    return mockResponse({ ...fixture, headline: "Validated live fixture" });
  };
  try {
    const result = await analyzeBoard(input);
    assert.equal(called, true);
    assert.equal(result.source, "openai");
    assert.equal(result.analysis.headline, "Validated live fixture");
  } finally {
    restore();
  }
});
for (const failure of [
  "quota",
  "network",
  "invalid-player",
  "opponent-player",
  "malformed-coordinate",
  "incomplete",
  "bad-json",
] as const) {
  test(`server recovers through deterministic fallback: ${failure}`, async () => {
    process.env.OPENAI_API_KEY = "test-placeholder-not-a-real-key";
    globalThis.fetch = async () => {
      if (failure === "quota")
        return new Response(
          JSON.stringify({
            error: {
              message: "Test quota exceeded",
              type: "insufficient_quota",
            },
          }),
          { status: 429 },
        );
      if (failure === "network") throw new Error("Test connection timeout");
      if (failure === "bad-json") return mockResponse(null);
      if (failure === "incomplete") return mockResponse(fixture, "incomplete");
      return mockResponse({
        ...fixture,
        recommendation: {
          ...fixture.recommendation,
          ...(failure === "invalid-player"
            ? { playerId: "not-on-board" }
            : failure === "opponent-player"
              ? { playerId: "ars-dm" }
              : { targetX: "invalid" }),
        },
      });
    };
    try {
      const result = await analyzeBoard(input);
      assert.equal(result.source, "fallback");
      assert.deepEqual(result.analysis, fixture);
    } finally {
      restore();
    }
  });
}
