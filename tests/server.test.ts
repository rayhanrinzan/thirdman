import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBoard } from "../src/lib/openai";
import { curatedAnalysis } from "../src/lib/curated";
import { createBoard, type LabRequest } from "../src/lib/lab";
const input: LabRequest = {
  scenario: "press",
  question: "How do we beat this press?",
  board: createBoard("press"),
};
const fixture = curatedAnalysis(input).analysis!;
const originalFetch = globalThis.fetch,
  originalKey = process.env.OPENAI_API_KEY;
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
test("real SDK Responses parser validates a playable sequence and sends strict schema", async () => {
  process.env.OPENAI_API_KEY = "test-placeholder-not-a-real-key";
  let called = false;
  globalThis.fetch = async (_url, options) => {
    called = true;
    const payload = JSON.parse(String(options?.body));
    assert.equal(payload.text.format.type, "json_schema");
    assert.equal(payload.text.format.strict, true);
    assert.equal(payload.store, false);
    assert.equal(JSON.parse(payload.input).board.players.length, 22);
    return mockResponse({ ...fixture, headline: "Validated live sequence" });
  };
  try {
    const result = await analyzeBoard(input);
    assert.ok(called);
    assert.equal(result.source, "openai");
    assert.equal(result.analysis?.headline, "Validated live sequence");
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
  "broken-chain",
] as const) {
  test(`server recovers with a curated sequence: ${failure}`, async () => {
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
      const actions = structuredClone(fixture.actions);
      if (failure === "broken-chain")
        actions[1] = {
          type: "pass",
          fromId: "dm",
          toId: "lcb",
          durationMs: 1000,
          caption: "Invalid chain",
        };
      else
        actions[0] = {
          ...actions[0],
          ...(failure === "invalid-player"
            ? { playerId: "unknown" }
            : failure === "opponent-player"
              ? { playerId: "ars-dm" }
              : { targetX: "invalid" }),
        } as (typeof actions)[number];
      return mockResponse({ ...fixture, actions });
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
