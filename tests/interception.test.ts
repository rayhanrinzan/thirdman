import test from "node:test";
import assert from "node:assert/strict";
import {
  createBoard, movePlayer, passDuration, passLane, staticPassLane,
  simulateAction, sweptBallDistance, reachableInterceptors, distance,
  passingOptions, validateSequence, type Action,
} from "../src/lib/lab";
import { curatedAnalysis } from "../src/lib/curated";

function setup(receiver = { x: 60, y: 50 }, defender = { x: 45, y: 66 }) {
  const base = createBoard("press");
  let board = {
    ...base,
    players: base.players.map((p) => p.team === "arsenal" ? { ...p, x: 96, y: 96 } : p),
  };
  board = movePlayer(board, "lcb", receiver);
  board = movePlayer(board, "ars-st", defender);
  const action: Extract<Action, { type: "pass" }> = {
    type: "pass", fromId: "gk", toId: "lcb",
    durationMs: passDuration(board, "gk", "lcb"), caption: "Play the diagonal.",
  };
  return { board, action };
}

test("reject a pass a defender can cut out even when the displayed slow pursuit misses it", () => {
  const { board, action } = setup();
  assert.equal(staticPassLane(board, "gk", "lcb").blocked, false);
  const simulation = simulateAction(board, action);
  const pursuitClearance = Math.min(...simulation.frames.slice(1).map((f, i) =>
    sweptBallDistance(simulation.frames[i].ball, f.ball,
      simulation.frames[i].board.players.find((p) => p.id === "ars-st")!,
      f.board.players.find((p) => p.id === "ars-st")!),
  ));
  assert.ok(pursuitClearance > 4, "The old trajectory-only validator approved this pass");
  // Independent witness: this defender can meet the ball after 1.25 seconds.
  const meeting = { x: 8 + 52 * 1.25 / 1.65, y: 50 };
  assert.ok(distance({ x: 45, y: 66 }, meeting) < 4 + 6 * (1.25 - 0.18));
  assert.deepEqual(reachableInterceptors(board, action), ["ars-st"]);
  assert.deepEqual(passLane(board, "gk", "lcb").blockerIds, ["ars-st"]);
  const sequence = curatedAnalysis({ scenario: "press", board: createBoard("press"), question: "free player" }).analysis!;
  assert.throws(() => validateSequence({ ...sequence, actions: [action] }, board), /blocked lane/);
});

test("protect the first touch when a marker arrives just after the ball", () => {
  const { board, action } = setup({ x: 25, y: 50 }, { x: 34.6, y: 50 });
  for (let ms = 0; ms <= action.durationMs; ms++) {
    const ball = { x: 8 + 17 * ms / action.durationMs, y: 50 };
    assert.ok(distance({ x: 34.6, y: 50 }, ball) > 4 + 6 * Math.max(0, ms / 1000 - 0.18));
  }
  assert.equal(passLane(board, "gk", "lcb").blocked, true);
  assert.equal(passingOptions(board).find((p) => p.player.id === "lcb")!.blocked, true);
});

test("every defender can intercept, including a third defender and a stationary goalkeeper", () => {
  const fixture = setup();
  let board = movePlayer(fixture.board, "ars-lw", { x: 10, y: 75 });
  board = movePlayer(board, "ars-rw", { x: 10, y: 25 });
  const result = simulateAction(board, fixture.action);
  assert.ok(!result.frames[1].pressingIds.includes("ars-st"));
  assert.ok(result.interceptorIds.includes("ars-st"));
  board = movePlayer(board, "ars-st", { x: 96, y: 96 });
  board = movePlayer(board, "ars-gk", { x: 45, y: 66 });
  assert.ok(passLane(board, "gk", "lcb").blockerIds.includes("ars-gk"));
});

test("a defender who only reaches a lane after the ball has gone does not block it", () => {
  const { board, action } = setup(undefined, { x: 12, y: 65 });
  assert.deepEqual(reachableInterceptors(board, action), []);
  assert.equal(passLane(board, "gk", "lcb").blocked, false);
});

test("continuous reach check covers an independent millisecond sweep across defensive positions", () => {
  let threats = 0, clear = 0;
  for (let x = 10; x <= 70; x += 5) {
    for (let y = 8; y <= 92; y += 7) {
      const { board, action } = setup(undefined, { x, y });
      let reachable = false;
      for (let ms = 0; ms <= action.durationMs + 200; ms++) {
        const ball = { x: 8 + 52 * Math.min(1, ms / action.durationMs), y: 50 };
        if (Math.hypot(x - ball.x, (y - ball.y) * 0.62) <= 4 + 6 * Math.max(0, ms / 1000 - 0.18)) {
          reachable = true;
          break;
        }
      }
      const predicted = reachableInterceptors(board, action).includes("ars-st");
      assert.equal(predicted, reachable, `Defender at ${x},${y}`);
      if (reachable) threats++; else clear++;
    }
  }
  assert.ok(threats > 20 && clear > 20);
});
