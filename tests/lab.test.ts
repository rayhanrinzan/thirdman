import test from "node:test";
import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import {
  applyActions,
  changeFormation,
  createBoard,
  formationNames,
  historyReducer,
  labRequestSchema,
  laneDistance,
  movePlayer,
  passingOptions,
  sampleSequence,
  sequenceSchema,
  totalDuration,
  validateSequence,
  type History,
} from "../src/lib/lab";
import { curatedAnalysis, explorations } from "../src/lib/curated";
for (const scenario of ["press", "block", "lead"] as const) {
  for (const e of explorations) {
    test(`${scenario}: curated ${e.label} is a valid playable sequence`, () => {
      const board = createBoard(scenario),
        result = curatedAnalysis({ scenario, board, question: e.question });
      assert.ok(result.analysis);
      const seq = validateSequence(result.analysis, board);
      assert.ok(seq.actions.some((a) => a.type === "move"));
      assert.ok(seq.actions.filter((a) => a.type === "pass").length >= 2);
      assert.ok(totalDuration(seq.actions) < 18000);
      const final = applyActions(board, seq.actions);
      assert.notDeepEqual(final, board);
      assert.ok(
        final.players.every(
          (p) => p.x >= 4 && p.x <= 96 && p.y >= 4 && p.y <= 96,
        ),
      );
    });
  }
}
test("canonical press sequence drops DM and counter creates midfield space", () => {
  const b = createBoard("press"),
    s = curatedAnalysis({
      scenario: "press",
      board: b,
      question: "How do we beat this press?",
    }).analysis!;
  const end = applyActions(b, s.actions),
    counter = applyActions(end, s.opponent.movements);
  assert.equal(end.players.find((p) => p.id === "dm")!.x, 25);
  assert.equal(end.players.find((p) => p.id === "dm")!.y, 50);
  assert.equal(end.possession, "rcb");
  assert.equal(counter.players.find((p) => p.id === "ars-dm")!.x, 34);
  assert.equal(s.opponent.space.x, 62);
  assert.equal(s.opponent.outletPlayerId, "lcm");
  assert.equal(b.players.find((p) => p.id === "dm")!.x, 43);
});
test("timeline samples interpolate and never mutate editable board; exact repeated time freezes ball", () => {
  const b = createBoard("press"),
    s = curatedAnalysis({
      scenario: "press",
      board: b,
      question: "free player",
    }).analysis!;
  const mid = sampleSequence(b, s.actions, 700);
  const dm = mid.board.players.find((p) => p.id === "dm")!;
  assert.ok(dm.x > 25 && dm.x < 43);
  const pass = sampleSequence(b, s.actions, 1900);
  assert.notDeepEqual(
    pass.ball,
    b.players.find((p) => p.id === b.possession),
  );
  assert.deepEqual(pass, sampleSequence(b, s.actions, 1900));
  assert.deepEqual(b, createBoard("press"));
  assert.deepEqual(
    sampleSequence(b, s.actions, totalDuration(s.actions)).board,
    applyActions(b, s.actions),
  );
});
test("unsupported questions are honest and opponent possession never invents passes", () => {
  const b = createBoard("press");
  assert.equal(
    curatedAnalysis({
      scenario: "press",
      board: b,
      question: "Who will win the league?",
    }).analysis,
    null,
  );
  const result = curatedAnalysis({
    scenario: "press",
    board: { ...b, possession: "ars-dm" },
    question: "create a free player",
  });
  assert.ok(result.notice?.includes("Arsenal"));
  assert.ok(result.analysis!.actions.every((a) => a.type !== "pass"));
});
test("formations preserve identity, update roles, and undo/redo retain all board state", () => {
  const b = createBoard("press");
  for (const team of ["tottenham", "arsenal"] as const)
    for (const f of formationNames) {
      const next = changeFormation(b, team, f);
      assert.deepEqual(
        next.players.map((p) => p.id),
        b.players.map((p) => p.id),
      );
      assert.ok(
        labRequestSchema.safeParse({
          scenario: "press",
          board: next,
          question: "explore",
        }).success,
      );
      assert.equal(next.custom[team], false);
    }
  const changed = changeFormation(b, "arsenal", "3–2–5");
  let h: History = { board: b, past: [], future: [] };
  h = historyReducer(h, { type: "commit", board: changed, label: "Formation" });
  h = historyReducer(h, {
    type: "commit",
    board: { ...changed, possession: "ars-dm" },
    label: "Possession",
  });
  h = historyReducer(h, { type: "undo" });
  assert.deepEqual(h.board, changed);
  h = historyReducer(h, { type: "undo" });
  assert.deepEqual(h.board, b);
  h = historyReducer(h, { type: "redo" });
  assert.deepEqual(h.board, changed);
});
test("a drag records one gesture, and a new edit clears redo", () => {
  const b = createBoard("press");
  let h: History = { board: b, past: [], future: [] };
  for (let x = 20; x < 40; x++)
    h = historyReducer(h, {
      type: "live",
      board: movePlayer(h.board, "ars-dm", { x, y: 35 }),
    });
  assert.equal(h.past.length, 0);
  h = historyReducer(h, { type: "gesture", before: b });
  assert.equal(h.past.length, 1);
  h = historyReducer(h, { type: "undo" });
  assert.deepEqual(h.board, b);
  h = historyReducer(h, {
    type: "commit",
    board: { ...b, possession: "dm" },
    label: "Ball",
  });
  assert.equal(h.future.length, 0);
});
test("reject invalid identities, ownership, coordinates, passing order, no-ops and excessive movement count", () => {
  const b = createBoard("press"),
    s = curatedAnalysis({
      scenario: "press",
      board: b,
      question: "free player",
    }).analysis!;
  const withAction = (a: unknown) => ({
    ...s,
    actions: [a, ...s.actions.slice(1)],
  });
  const m = s.actions[0];
  assert.equal(m.type, "move");
  for (const playerId of ["missing", "ars-dm"])
    assert.throws(() => validateSequence(withAction({ ...m, playerId }), b));
  for (const targetX of [NaN, Infinity, "24", null])
    assert.throws(() => validateSequence(withAction({ ...m, targetX }), b));
  assert.throws(() =>
    validateSequence(
      {
        ...s,
        actions: [
          {
            type: "pass",
            fromId: "dm",
            toId: "lcb",
            caption: "Invalid chain",
            durationMs: 1000,
          },
        ],
      },
      b,
    ),
  );
  assert.throws(() =>
    validateSequence(
      {
        ...s,
        actions: [
          {
            type: "move",
            playerId: "dm",
            targetX: 43,
            targetY: 50,
            caption: "No-op",
            durationMs: 1000,
          },
        ],
      },
      b,
    ),
  );
  assert.throws(() => validateSequence({ ...s, actions: [m, m, m, m] }, b));
  assert.throws(() =>
    validateSequence(
      {
        ...s,
        opponent: {
          ...s.opponent,
          movements: [{ ...s.opponent.movements[0], playerId: "dm" }],
        },
      },
      b,
    ),
  );
  const clamped = validateSequence(
    withAction({ ...m, targetX: -99, targetY: 120 }),
    b,
  );
  assert.equal(
    clamped.actions[0].type === "move" && clamped.actions[0].targetX,
    4,
  );
  assert.equal(zodTextFormat(sequenceSchema, "sequence").strict, true);
});
test("geometric passing lanes flag nearby opponents without fabricated scores", () => {
  assert.equal(
    laneDistance({ x: 50, y: 50 }, { x: 0, y: 50 }, { x: 100, y: 50 }),
    0,
  );
  const b = createBoard("press");
  const options = passingOptions(b);
  assert.equal(options.length, 4);
  assert.ok(options.every((p) => typeof p.blocked === "boolean"));
});
