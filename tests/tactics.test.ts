import test from "node:test";
import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import {
  analysisSchema,
  initialPlayers,
  requestSchema,
  scenarioIds,
  scenarios,
  validateAnalysis,
} from "../src/lib/tactics";
import { fallbackAnalysis } from "../src/lib/fallback";

for (const scenario of scenarioIds) {
  test(`${scenario}: complete roster and valid usable fallback`, () => {
    const players = initialPlayers(scenario);
    assert.equal(new Set(players.map((p) => p.id)).size, 22);
    assert.equal(players.filter((p) => p.team === "tottenham").length, 11);
    const settings = scenarios[scenario];
    assert.ok(
      requestSchema.safeParse({
        scenario,
        players,
        question: settings.question,
        userFormation: settings.userFormation,
        opponentFormation: settings.opponentFormation,
      }).success,
    );
    const result = validateAnalysis(
      fallbackAnalysis(scenario, players),
      players,
    );
    assert.equal(result.whyItWorks.length, 3);
    const player = players.find(
      (p) => p.id === result.recommendation.playerId,
    )!;
    assert.equal(player.team, "tottenham");
    assert.ok(
      Math.hypot(
        player.x - result.recommendation.targetX,
        player.y - result.recommendation.targetY,
      ) > 10,
    );
  });
}
test("press target is exactly between current center backs, including after editing", () => {
  const players = initialPlayers("press");
  assert.deepEqual(fallbackAnalysis("press", players).recommendation, {
    playerId: "dm",
    instruction: "Drop the defensive midfielder between the center backs.",
    targetX: 25,
    targetY: 50,
  });
  players.find((p) => p.id === "lcb")!.x = 18;
  players.find((p) => p.id === "rcb")!.x = 22;
  assert.equal(fallbackAnalysis("press", players).recommendation.targetX, 20);
});
test("rejects invalid IDs, opponents, malformed coordinates and incomplete or oversized text", () => {
  const players = initialPlayers("press");
  const result = fallbackAnalysis("press", players);
  for (const playerId of ["unknown", "ars-dm"])
    assert.throws(() =>
      validateAnalysis(
        { ...result, recommendation: { ...result.recommendation, playerId } },
        players,
      ),
    );
  for (const targetX of [NaN, Infinity, "25", null])
    assert.throws(() =>
      validateAnalysis(
        { ...result, recommendation: { ...result.recommendation, targetX } },
        players,
      ),
    );
  assert.throws(() =>
    validateAnalysis({ ...result, diagnosis: "a".repeat(321) }, players),
  );
  assert.throws(() =>
    validateAnalysis({ ...result, whyItWorks: ["only one"] }, players),
  );
  assert.throws(() => validateAnalysis({ headline: "Incomplete" }, players));
  const clamped = validateAnalysis(
    {
      ...result,
      recommendation: { ...result.recommendation, targetX: -20, targetY: 200 },
    },
    players,
  );
  assert.equal(clamped.recommendation.targetX, 4);
  assert.equal(clamped.recommendation.targetY, 96);
});
test("rejects duplicate or reassigned players and empty questions", () => {
  const input = {
    scenario: "press",
    ...scenarios.press,
    players: initialPlayers("press"),
  };
  const valid = {
    scenario: input.scenario,
    question: input.question,
    userFormation: input.userFormation,
    opponentFormation: input.opponentFormation,
    players: input.players,
  };
  assert.ok(requestSchema.safeParse(valid).success);
  assert.equal(
    requestSchema.safeParse({ ...valid, question: " " }).success,
    false,
  );
  assert.equal(
    requestSchema.safeParse({
      ...valid,
      players: valid.players.map(() => valid.players[0]),
    }).success,
    false,
  );
});
test("installed OpenAI SDK creates strict Responses JSON schema from Zod", () => {
  const format = zodTextFormat(analysisSchema, "tactical_analysis");
  assert.equal(format.type, "json_schema");
  assert.equal(format.strict, true);
  assert.equal(format.schema.additionalProperties, false);
});
