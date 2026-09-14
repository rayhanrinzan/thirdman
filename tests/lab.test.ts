import test from "node:test";
import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import {
  applyActions,
  applyAction,
  changeFormation,
  createBoard,
  formationNames,
  historyReducer,
  labRequestSchema,
  laneDistance,
  movePlayer,
  passingOptions,
  passLane,
  staticPassLane,
  simulateAction,
  sweptBallDistance,
  passDuration,
  compileSequence,
  sampleTimeline,
  findPassingRoute,
  PASS_LANE_CLEARANCE,
  sampleSequence,
  sequenceSchema,
  totalDuration,
  validateSequence,
  type History,
  type Action,
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
      const passes = seq.actions.filter((a) => a.type === "pass");
      assert.ok(passes.length >= 2 || result.notice?.includes("no open route"));
      let current = board;
      for (const action of seq.actions) {
        if (action.type === "pass")
          assert.equal(
            passLane(current, action.fromId, action.toId).blocked,
            false,
          );
        current = applyAction(current, action);
      }
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
  assert.equal(end.possession, "dm");
  assert.equal(passLane(end, "dm", "rcb").blocked, true);
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

test("overlay and validator reject the same blocked pass, using positions at each step", () => {
  const base = createBoard("press");
  const board = {
    ...base,
    players: base.players.map((p) =>
      p.team === "arsenal" ? { ...p, x: 96, y: 96 } : p,
    ),
  };
  const blocked = movePlayer(board, "ars-st", { x: 16.5, y: 41.5 });
  const sequence = curatedAnalysis({
    scenario: "press",
    board,
    question: "free player",
  }).analysis!;
  const pass = {
    type: "pass" as const,
    fromId: "gk",
    toId: "lcb",
    durationMs: 1000,
    caption: "Play into the center back.",
  };
  assert.equal(
    passingOptions(blocked).find((o) => o.player.id === "lcb")!.blocked,
    true,
  );
  assert.deepEqual(passLane(blocked, "gk", "lcb").blockerIds, ["ars-st"]);
  assert.throws(
    () => validateSequence({ ...sequence, actions: [pass] }, blocked),
    /blocked lane/,
  );
  const move = {
    type: "move" as const,
    playerId: "lcb",
    targetX: 25,
    targetY: 67,
    durationMs: 1000,
    caption: "Move into an open receiving lane.",
  };
  assert.doesNotThrow(() =>
    validateSequence({ ...sequence, actions: [move, pass] }, blocked),
  );
  const open = applyAction(blocked, move);
  assert.equal(passLane(open, "gk", "lcb").blocked, false);
  assert.throws(
    () =>
      validateSequence(
        { ...sequence, actions: [{ ...move, targetY: 33 }, pass] },
        open,
      ),
    /blocked lane/,
  );
});

test("lane geometry includes receiver pressure and keeps a consistent clearance boundary", () => {
  const base = createBoard("press");
  let board = {
    ...base,
    players: base.players.map((p) =>
      p.team === "arsenal" ? { ...p, x: 96, y: 96 } : p,
    ),
  };
  board = movePlayer(board, "lcb", { x: 25, y: 50 });
  board = movePlayer(board, "ars-st", {
    x: 25 + PASS_LANE_CLEARANCE - 0.01,
    y: 50,
  });
  assert.equal(passLane(board, "gk", "lcb").blocked, true);
  board = movePlayer(board, "ars-st", { x: 25 + PASS_LANE_CLEARANCE, y: 50 });
  assert.equal(staticPassLane(board, "gk", "lcb").blocked, false);
  assert.equal(passLane(board, "gk", "lcb").blocked, true); // A defender can close the boundary during flight.
  assert.equal(passLane(board, "gk", "ars-st").blocked, true);
  assert.equal(passLane(board, "gk", "gk").blocked, true);
});

test("routing finds an open supporting pass and honors the remaining pass budget", () => {
  const base = createBoard("press");
  const board = movePlayer(
    {
      ...base,
      players: base.players.map((p) =>
        p.team === "arsenal" ? { ...p, x: 96, y: 96 } : p,
      ),
    },
    "ars-st",
    { x: 16.5, y: 41.5 },
  );
  assert.equal(findPassingRoute(board, "lcb", 1), null);
  const path = findPassingRoute(board, "lcb", 2)!;
  assert.equal(path.length, 2);
  assert.equal(path.at(-1), "lcb");
  let current = board;
  for (const id of path) {
    const owner = current.possession;
    assert.equal(passLane(current, owner, id).blocked, false);
    current = applyAction(current, {
      type: "pass", fromId: owner, toId: id,
      durationMs: passDuration(current, owner, id), caption: "Use the open support.",
    });
  }
});

test("curated routes remain open after formation edits and changed possession", () => {
  for (const scenario of ["press", "block", "lead"] as const)
    for (const formation of formationNames)
      for (const exploration of explorations) {
        const board = {
          ...changeFormation(createBoard(scenario), "tottenham", formation),
          possession: "lw",
        };
        const result = curatedAnalysis({
          scenario,
          board,
          question: exploration.question,
        });
        if (!result.analysis) {
          assert.ok(result.notice?.includes("No safe sequence"));
          continue;
        }
        const seq = validateSequence(result.analysis, board);
        assert.ok(seq.actions.filter((a) => a.type === "pass").length <= 4);
      }
});

test("a surrounded ball carrier gets a shape-only guide with an honest explanation", () => {
  const board = movePlayer(createBoard("press"), "ars-st", { x: 8, y: 50 });
  const result = curatedAnalysis({
    scenario: "press",
    board,
    question: "free player",
  });
  assert.equal(findPassingRoute(board, "lcb", 4), null);
  assert.equal(
    result.analysis!.actions.some((a) => a.type === "pass"),
    false,
  );
  assert.match(result.notice!, /no open route/);
  assert.equal(applyActions(board, result.analysis!.actions).possession, "gk");
});

test("reactive playback moves the nearest defenders and shifts the block without moving goalkeepers", () => {
  const board = createBoard("press");
  const pass = {
    type: "pass" as const,
    fromId: "gk",
    toId: "lcb",
    durationMs: 1000,
    caption: "Draw the first presser.",
  };
  const result = simulateAction(board, pass);
  const final = result.frames.at(-1)!.board;
  assert.ok(
    final.players.some(
      (p) =>
        p.team === "arsenal" &&
        p.x !== board.players.find((q) => q.id === p.id)!.x,
    ),
  );
  for (const p of final.players) {
    if (p.team === "tottenham" || p.role === "GK")
      assert.deepEqual(
        p,
        board.players.find((q) => q.id === p.id),
      );
    assert.ok(p.x >= 4 && p.x <= 96 && p.y >= 4 && p.y <= 96);
  }
  assert.ok(result.frames.some((f) => f.pressingIds.length > 0));
  assert.ok(result.frames.every((f) => f.pressingIds.length <= 2));
  for (let i = 1; i < result.frames.length; i++) {
    const a = result.frames[i - 1],
      b = result.frames[i];
    for (const p of b.board.players.filter((p) => p.team === "arsenal")) {
      const q = a.board.players.find((q) => q.id === p.id)!;
      assert.ok(
        Math.hypot(p.x - q.x, (p.y - q.y) * 0.62) <=
          (3.8 * (b.time - a.time)) / 1000 + 1e-8,
        "Defenders must not teleport when pressing roles change",
      );
    }
  }
  assert.deepEqual(simulateAction(board, pass), result);
  assert.deepEqual(board, createBoard("press"));
});

test("swept interception catches a ball and defender crossing between frames", () => {
  assert.equal(
    sweptBallDistance(
      { x: 0, y: 50 },
      { x: 20, y: 50 },
      { x: 10, y: 50 },
      { x: 10, y: 50 },
    ),
    0,
  );
  assert.equal(
    sweptBallDistance(
      { x: 0, y: 50 },
      { x: 20, y: 50 },
      { x: 10, y: 40 },
      { x: 10, y: 60 },
    ),
    0,
  );
});

test("an initially clear pass is rejected when a defender reaches it during flight", () => {
  const base = createBoard("press");
  let board = {
    ...base,
    players: base.players.map((p) =>
      p.team === "arsenal" ? { ...p, x: 96, y: 96 } : p,
    ),
  };
  board = movePlayer(board, "lcb", { x: 25, y: 50 });
  board = movePlayer(board, "ars-st", { x: 29.1, y: 50 });
  assert.equal(staticPassLane(board, "gk", "lcb").blocked, false);
  assert.deepEqual(passLane(board, "gk", "lcb").blockerIds, ["ars-st"]);
  assert.equal(
    passingOptions(board).find((p) => p.player.id === "lcb")!.blocked,
    true,
  );
  const fixture = curatedAnalysis({
    scenario: "press",
    board: base,
    question: "free player",
  }).analysis!;
  assert.throws(
    () =>
      validateSequence(
        {
          ...fixture,
          actions: [
            {
              type: "pass",
              fromId: "gk",
              toId: "lcb",
              durationMs: 400,
              caption: "Try an unrealistically fast pass.",
            },
          ],
        },
        board,
      ),
    /blocked lane/,
  );
});

test("circulation cannot claim a lane is open just because a presser chases the previous ball", () => {
  const base = createBoard("press");
  let board = {
    ...base,
    players: base.players.map((p) =>
      !["gk", "lcb", "dm"].includes(p.id) ? { ...p, x: 96, y: 96 } : p,
    ),
  };
  board = movePlayer(board, "lcb", { x: 30, y: 50 });
  board = movePlayer(board, "dm", { x: 18, y: 80 });
  board = movePlayer(board, "ars-st", { x: 20, y: 55.5 });
  board = movePlayer(board, "ars-lw", { x: 25, y: 65 });
  assert.equal(passLane(board, "gk", "lcb").blocked, true);
  assert.equal(findPassingRoute(board, "lcb", 2), null);
  // The previous model accepted DM → GK → LCB by assuming the defender
  // continued a slow pursuit. The defender can instead attack the next lane.
  assert.equal(findPassingRoute(board, "lcb", 3), null);
  const returnPass: Action = {
    type: "pass", fromId: "gk", toId: "dm", durationMs: 1000,
    caption: "Invite pressure.",
  };
  const afterFirst = applyAction(board, returnPass);
  assert.equal(passLane(afterFirst, "dm", "gk").blocked, true);
});

test("scrub, replay and application share defensive frames; undo restores both teams", () => {
  const board = createBoard("press");
  const sequence = curatedAnalysis({
    scenario: "press",
    board,
    question: "Draw the press and switch play",
  }).analysis!;
  assert.ok(sequence.actions.some((a) => a.type === "highlight"));
  const compiled = compileSequence(board, sequence.actions);
  const paused = sampleTimeline(compiled, 2055);
  sampleTimeline(compiled, 100);
  sampleTimeline(compiled, compiled.duration);
  assert.deepEqual(sampleTimeline(compiled, 2055), paused);
  assert.deepEqual(compiled.finalBoard, applyActions(board, sequence.actions));
  assert.notDeepEqual(
    compiled.finalBoard.players.filter((p) => p.team === "arsenal"),
    board.players.filter((p) => p.team === "arsenal"),
  );
  let history: History = { board, past: [], future: [] };
  history = historyReducer(history, {
    type: "commit",
    board: compiled.finalBoard,
    label: "Reactive sequence",
  });
  history = historyReducer(history, { type: "undo" });
  assert.deepEqual(history.board, board);
  history = historyReducer(history, { type: "redo" });
  assert.deepEqual(history.board, compiled.finalBoard);
});

test("pass timing is distance-based and cannot be shortened by model output", () => {
  const board = createBoard("press");
  const fixture = curatedAnalysis({
    scenario: "press",
    board,
    question: "free player",
  }).analysis!;
  const sequence = validateSequence(
    {
      ...fixture,
      actions: fixture.actions.map((a) =>
        a.type === "pass" ? { ...a, durationMs: 400 } : a,
      ),
    },
    board,
  );
  assert.deepEqual(sequence.actions, fixture.actions);
  assert.ok(passDuration(board, "gk", "st") > passDuration(board, "gk", "lcb"));
});

test("default demos retain safe passes and omit combinations the defense can cut out", () => {
  for (const scenario of ["press", "block", "lead"] as const) {
    const board = createBoard(scenario);
    const result = curatedAnalysis({
      scenario,
      board,
      question: "create a free player",
    });
    assert.ok(result.analysis!.actions.some((a) => a.type === "move"));
    if (!result.analysis!.actions.some((a) => a.type === "pass"))
      assert.ok(result.notice?.includes("no open route"));
    const final = applyActions(board, result.analysis!.actions);
    assert.notDeepEqual(
      final.players.filter((p) => p.team === "arsenal"),
      board.players.filter((p) => p.team === "arsenal"),
    );
    if (scenario === "block") {
      assert.equal(
        result.analysis!.actions[0].type,
        "pass",
        "Release the pressured carrier before waiting for the winger's run",
      );
      assert.ok(result.notice?.includes("no open route"));
    }
  }
});
