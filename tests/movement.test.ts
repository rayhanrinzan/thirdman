import test from "node:test";
import assert from "node:assert/strict";
import {
  createBoard, movePlayer, planMovement, prepareMove, simulateAction,
  validateSequence, distance, sweptBallDistance, applyActions,
  compileSequence, sampleTimeline, historyReducer,
  type MoveAction, type Sequence, type Board,
} from "../src/lib/lab";
import { curatedAnalysis } from "../src/lib/curated";

const run: MoveAction = {
  type: "move", playerId: "lcb", targetX: 50, targetY: 50,
  durationMs: 1400, caption: "Reposition into the next line.",
};
function isolatedBoard() {
  const base = createBoard("press");
  let board = { ...base, players: base.players.map((p) =>
    p.team === "arsenal" ? { ...p, x: 96, y: 96 } : p,
  ) };
  board = movePlayer(board, "lcb", { x: 30, y: 50 });
  return movePlayer(board, "ars-st", { x: 40, y: 50 });
}
function sequenceFor(action: MoveAction): Sequence {
  const seq = structuredClone(curatedAnalysis({
    scenario: "press", board: createBoard("press"), question: "free player",
  }).analysis!);
  seq.actions = [action];
  seq.opponent.movements = [{
    ...run, playerId: "ars-gk", targetX: 94, targetY: 92,
  }];
  return seq;
}

test("a dribble with clear endpoints cannot cross a defender in the middle", () => {
  const board = { ...isolatedBoard(), possession: "lcb" };
  assert.equal(distance(board.players.find((p) => p.id === "ars-st")!, { x: 30, y: 50 }), 10);
  assert.equal(distance(board.players.find((p) => p.id === "ars-st")!, { x: 50, y: 50 }), 10);
  assert.throws(() => validateSequence(sequenceFor(run), board), /tackle/);
  const simulation = simulateAction(board, prepareMove(board, run));
  assert.ok(simulation.tacklerIds.includes("ars-st"));
});

test("an off-ball run detours around the same defender without inventing a turnover", () => {
  const board = isolatedBoard();
  const path = planMovement(board, run)!;
  assert.ok(path.length > 2);
  const result = simulateAction(board, run);
  assert.equal(result.movementBlocked, false);
  assert.deepEqual(result.tacklerIds, []);
  assert.equal(result.frames.at(-1)!.board.possession, "gk");
  for (let i = 1; i < result.frames.length; i++) {
    const before = result.frames[i - 1], after = result.frames[i];
    const runnerBefore = before.board.players.find((p) => p.id === run.playerId)!;
    const runnerAfter = after.board.players.find((p) => p.id === run.playerId)!;
    for (const opponent of before.board.players.filter((p) => p.team === "arsenal")) {
      assert.ok(sweptBallDistance(runnerBefore, runnerAfter, opponent,
        after.board.players.find((p) => p.id === opponent.id)!) >= 4 - 1e-7);
    }
  }
  assert.deepEqual(validateSequence(sequenceFor(run), board).actions, [run]);
});

test("safe carries use bounded speed, keep the ball attached, and cannot bypass checks with 400 ms timing", () => {
  const board = movePlayer(isolatedBoard(), "ars-st", { x: 96, y: 96 });
  const requested: MoveAction = { ...run, playerId: "gk", targetX: 18, durationMs: 400 };
  assert.equal(simulateAction(board, requested).movementBlocked, true);
  const seq = validateSequence(sequenceFor(requested), board);
  assert.equal(seq.actions[0].durationMs, 3000);
  const result = simulateAction(board, seq.actions[0]);
  assert.equal(result.movementBlocked, false);
  assert.deepEqual(result.tacklerIds, []);
  for (let i = 1; i < result.frames.length; i++) {
    const before = result.frames[i - 1], after = result.frames[i];
    const player = after.board.players.find((p) => p.id === "gk")!;
    assert.equal(distance(after.ball, player), 0);
    assert.ok(distance(before.ball, after.ball) <= 5 * (after.time - before.time) / 1000 + 1e-7);
  }
  const compiled = compileSequence(board, seq.actions);
  assert.deepEqual(compiled.finalBoard, applyActions(board, seq.actions));
  const paused = sampleTimeline(compiled, 1234);
  sampleTimeline(compiled, 2500);
  assert.deepEqual(sampleTimeline(compiled, 1234), paused);
  const history = historyReducer({ board, past: [], future: [] }, { type: "commit", board: compiled.finalBoard, label: "Safe carry" });
  assert.deepEqual(historyReducer(history, { type: "undo" }).board, board);
});

test("reject an occupied destination and never teleport a runner when no route exists", () => {
  const board = isolatedBoard();
  const blocked = { ...run, targetX: 40 };
  assert.equal(planMovement(board, blocked), null);
  const simulation = simulateAction(board, blocked);
  assert.equal(simulation.movementBlocked, true);
  assert.equal(simulation.frames.at(-1)!.board.players.find((p) => p.id === "lcb")!.x, 30);
  assert.throws(() => validateSequence(sequenceFor(blocked), board), /Movement crosses/);
});

test("the protect-a-lead guide moves an off-ball midfielder instead of dribbling through the press", () => {
  const board = createBoard("lead");
  const original: MoveAction = { ...run, playerId: "rcm", targetX: 42, targetY: 62 };
  assert.throws(() => validateSequence(sequenceFor(original), board), /tackle/);
  const result = curatedAnalysis({ scenario: "lead", board, question: "protect our lead" });
  assert.ok(result.analysis);
  assert.ok(result.analysis.actions.some((a) => a.type === "move" && a.playerId === "lcm"));
  let current: Board = board;
  for (const action of result.analysis.actions) {
    const simulation = simulateAction(current, action);
    assert.equal(simulation.movementBlocked, false);
    assert.deepEqual(simulation.tacklerIds, []);
    if (action.type === "move") {
      for (let i = 1; i < simulation.frames.length; i++) {
        const before = simulation.frames[i - 1].board, after = simulation.frames[i].board;
        const a = before.players.find((p) => p.id === action.playerId)!;
        const b = after.players.find((p) => p.id === action.playerId)!;
        for (const opponent of before.players.filter((p) => p.team !== a.team))
          assert.ok(sweptBallDistance(a, b, opponent, after.players.find((p) => p.id === opponent.id)!) >= 4 - 1e-7);
      }
    }
    current = simulation.frames.at(-1)!.board;
  }
  assert.equal(current.possession, "rcm");
});
