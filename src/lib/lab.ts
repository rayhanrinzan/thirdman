import { z } from "zod";
import {
  clamp,
  initialPlayers,
  scenarioIds,
  scenarios,
  type Player,
  type Position,
  type ScenarioId,
} from "./tactics";
export type Team = Player["team"];
export const formationNames = ["4–3–3", "4–2–3–1", "3–2–5", "4–4–2"] as const;
export type Formation = (typeof formationNames)[number];
export type Board = {
  players: Player[];
  possession: string;
  formations: Record<Team, string>;
  custom: Record<Team, boolean>;
};
export function createBoard(scenario: ScenarioId): Board {
  return {
    players: initialPlayers(scenario),
    possession:
      scenario === "press" ? "gk" : scenario === "block" ? "lcm" : "rcm",
    formations: {
      tottenham: scenarios[scenario].userFormation,
      arsenal: scenarios[scenario].opponentFormation,
    },
    custom: { tottenham: false, arsenal: false },
  };
}
const formations: Record<
  Formation,
  { roles: string[]; positions: number[][] }
> = {
  "4–3–3": {
    roles: [
      "GK",
      "LB",
      "LCB",
      "RCB",
      "RB",
      "DM",
      "LCM",
      "RCM",
      "LW",
      "ST",
      "RW",
    ],
    positions: [
      [8, 50],
      [30, 12],
      [25, 33],
      [25, 67],
      [30, 88],
      [43, 50],
      [55, 29],
      [55, 71],
      [72, 12],
      [76, 50],
      [72, 88],
    ],
  },
  "4–2–3–1": {
    roles: [
      "GK",
      "LB",
      "LCB",
      "RCB",
      "RB",
      "LDM",
      "AM",
      "RDM",
      "LW",
      "ST",
      "RW",
    ],
    positions: [
      [8, 50],
      [30, 12],
      [25, 33],
      [25, 67],
      [30, 88],
      [43, 38],
      [62, 50],
      [43, 62],
      [65, 15],
      [80, 50],
      [65, 85],
    ],
  },
  "3–2–5": {
    roles: [
      "GK",
      "LWB",
      "LCB",
      "RCB",
      "RWB",
      "CB",
      "LDM",
      "RDM",
      "LAM",
      "ST",
      "RAM",
    ],
    positions: [
      [8, 50],
      [73, 10],
      [27, 25],
      [27, 75],
      [73, 90],
      [25, 50],
      [47, 35],
      [47, 65],
      [70, 31],
      [80, 50],
      [70, 69],
    ],
  },
  "4–4–2": {
    roles: [
      "GK",
      "LB",
      "LCB",
      "RCB",
      "RB",
      "LCM",
      "RCM",
      "RM",
      "LM",
      "LST",
      "RST",
    ],
    positions: [
      [8, 50],
      [29, 12],
      [25, 34],
      [25, 66],
      [29, 88],
      [47, 38],
      [47, 62],
      [52, 87],
      [52, 13],
      [73, 35],
      [73, 65],
    ],
  },
};
export function changeFormation(
  board: Board,
  team: Team,
  formation: Formation,
): Board {
  const shape = formations[formation];
  let index = 0;
  return {
    ...board,
    players: board.players.map((p) => {
      if (p.team !== team) return p;
      const i = index++,
        [x, y] = shape.positions[i];
      return {
        ...p,
        role: shape.roles[i],
        x: team === "tottenham" ? x : 100 - x,
        y: team === "tottenham" ? y : 100 - y,
      };
    }),
    formations: { ...board.formations, [team]: formation },
    custom: { ...board.custom, [team]: false },
  };
}
export function movePlayer(
  board: Board,
  id: string,
  position: Position,
): Board {
  const player = board.players.find((p) => p.id === id);
  if (!player) return board;
  return {
    ...board,
    players: board.players.map((p) =>
      p.id === id ? { ...p, x: clamp(position.x), y: clamp(position.y) } : p,
    ),
    custom: { ...board.custom, [player.team]: true },
  };
}
const short = (n: number) => z.string().trim().min(1).max(n);
const caption = short(140),
  durationMs = z.number().int().min(400).max(2400);
export const moveSchema = z
  .object({
    type: z.literal("move"),
    playerId: short(30),
    targetX: z.number(),
    targetY: z.number(),
    durationMs: z.number().int().min(400).max(6000),
    caption,
  })
  .strict();
const passSchema = z
  .object({
    type: z.literal("pass"),
    fromId: short(30),
    toId: short(30),
    durationMs,
    caption,
  })
  .strict();
const highlightSchema = z
  .object({
    type: z.literal("highlight"),
    playerIds: z.array(short(30)).min(1).max(3),
    durationMs,
    caption,
  })
  .strict();
export const actionSchema = z.discriminatedUnion("type", [
  moveSchema,
  passSchema,
  highlightSchema,
]);
export const sequenceSchema = z
  .object({
    headline: short(85),
    diagnosis: short(280),
    objective: short(160),
    tradeoff: short(220),
    beforeLabel: short(45),
    afterLabel: short(45),
    actions: z.array(actionSchema).min(1).max(9),
    opponent: z
      .object({
        explanation: short(280),
        movements: z.array(moveSchema).min(1).max(2),
        space: z
          .object({ x: z.number(), y: z.number(), label: short(70) })
          .strict(),
        outletPlayerId: short(30),
      })
      .strict(),
  })
  .strict();
export type Sequence = z.infer<typeof sequenceSchema>;
export type Action = z.infer<typeof actionSchema>;
export type MoveAction = z.infer<typeof moveSchema>;
const teamRecord = z
  .object({ tottenham: short(30), arsenal: short(30) })
  .strict();
export const boardSchema = z
  .object({
    players: z
      .array(
        z
          .object({
            id: short(30),
            role: short(8),
            team: z.enum(["tottenham", "arsenal"]),
            x: z.number().min(4).max(96),
            y: z.number().min(4).max(96),
          })
          .strict(),
      )
      .length(22),
    possession: short(30),
    formations: teamRecord,
    custom: z.object({ tottenham: z.boolean(), arsenal: z.boolean() }).strict(),
  })
  .strict();
export const labRequestSchema = z
  .object({
    scenario: z.enum(scenarioIds),
    question: short(500),
    board: boardSchema,
  })
  .strict()
  .superRefine((input, ctx) => {
    if (
      new Set(input.board.players.map((p) => p.id)).size !== 22 ||
      initialPlayers(input.scenario).some(
        (p) =>
          !input.board.players.some((q) => q.id === p.id && q.team === p.team),
      ) ||
      !input.board.players.some((p) => p.id === input.board.possession)
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid roster or possession",
        path: ["board"],
      });
  });
export type LabRequest = z.infer<typeof labRequestSchema>;
export type AnalysisResult = {
  analysis: Sequence | null;
  source: "openai" | "fallback";
  notice: string | null;
};
// All committed and previewed actions advance the same deterministic defensive model.
export function applyAction(board: Board, action: Action): Board {
  return simulateAction(board, action).frames.at(-1)!.board;
}
export function applyActions(board: Board, actions: Action[]): Board {
  return actions.reduce(applyAction, board);
}
export const totalDuration = (actions: Action[]) =>
  actions.reduce((n, a) => n + a.durationMs, 0);
export function validateSequence(value: unknown, board: Board): Sequence {
  const seq = sequenceSchema.parse(value);
  let current = board;
  let moves = 0,
    passes = 0,
    meaningful = false;
  const player = (id: string) => {
    const p = board.players.find((p) => p.id === id);
    if (!p) throw new Error("Unknown player");
    return p;
  };
  seq.actions = seq.actions.map((action) => {
    if (action.type === "move") {
      if (player(action.playerId).team !== "tottenham" || ++moves > 3)
        throw new Error("Invalid movement ownership or count");
      action = {
        ...action,
        targetX: clamp(action.targetX),
        targetY: clamp(action.targetY),
      };
      action = prepareMove(current, action);
      const id = action.playerId;
      const p = current.players.find((p) => p.id === id)!;
      meaningful ||=
        Math.hypot(p.x - action.targetX, p.y - action.targetY) > 0.5;
    } else if (action.type === "pass") {
      if (
        ++passes > 4 ||
        action.fromId !== current.possession ||
        action.fromId === action.toId ||
        player(action.fromId).team !== "tottenham" ||
        player(action.toId).team !== "tottenham"
      )
        throw new Error("Invalid possession chain");
      const { fromId, toId } = action;
      const from = current.players.find((p) => p.id === fromId)!,
        to = current.players.find((p) => p.id === toId)!;
      if (Math.hypot(from.x - to.x, from.y - to.y) < 1)
        throw new Error("Pass has no meaningful distance");
      action = { ...action, durationMs: passDuration(current, fromId, toId) };
      if (passLane(current, fromId, toId).blocked)
        throw new Error("Pass crosses a blocked lane");
      meaningful = true;
    } else action.playerIds.forEach(player);
    const simulation = simulateAction(current, action);
    if (simulation.movementBlocked || simulation.tacklerIds.length)
      throw new Error("Movement crosses an opponent or exposes the ball carrier to a tackle");
    current = simulation.frames.at(-1)!.board;
    return action;
  });
  if (!meaningful || totalDuration(seq.actions) > 18000)
    throw new Error("Empty or excessive sequence");
  seq.opponent.movements = seq.opponent.movements.map((action) => {
    if (player(action.playerId).team !== "arsenal")
      throw new Error("Counter must move Arsenal");
    const move = {
      ...action,
      targetX: clamp(action.targetX),
      targetY: clamp(action.targetY),
    };
    const p = current.players.find((p) => p.id === move.playerId)!;
    if (Math.hypot(p.x - move.targetX, p.y - move.targetY) < 0.5)
      throw new Error("Counter is a no-op");
    const simulation = simulateAction(current, move);
    if (simulation.movementBlocked || simulation.tacklerIds.length)
      throw new Error("Counter movement crosses an opponent");
    current = simulation.frames.at(-1)!.board;
    return move;
  });
  if (player(seq.opponent.outletPlayerId).team !== "tottenham")
    throw new Error("Invalid outlet");
  seq.opponent.space = {
    ...seq.opponent.space,
    x: clamp(seq.opponent.space.x),
    y: clamp(seq.opponent.space.y),
  };
  return seq;
}
/** Illustrative reaction model, not a match prediction. Times are simulated, never wall-clock. */
export const REACTION_STEP_MS = 50;
const REACTION_DELAY_MS = 180;
const PRESS_RANGE = 24;
const PRESS_SPEED = 3.8;
const SUPPORT_SPEED = 2.2;
const BLOCK_SPEED = 0.85;
const BALL_SPEED = 32;
// Closing a passing lane is a different action from jogging with the team's shape.
// Never assume a defender keeps following the ball when they could cut it out.
const INTERCEPT_SPEED = 6;
const FIRST_TOUCH_MS = 200;
export const MOVEMENT_CLEARANCE = 4;
const CARRY_SPEED = 5;
type SimulationFrame = {
  time: number;
  board: Board;
  ball: Position;
  pressingIds: string[];
};
const mix = (a: Position, b: Position, t: number): Position => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
function toward(from: Position, target: Position, maximum: number): Position {
  const length = distance(from, target);
  return mix(from, target, length ? Math.min(1, maximum / length) : 0);
}
function actionBall(base: Board, action: Action, time: number, path?: Position[] | null): Position {
  const owner = base.players.find((p) => p.id === base.possession)!;
  const t = Math.max(0, Math.min(1, time / action.durationMs));
  if (action.type === "pass")
    return mix(
      owner,
      base.players.find((p) => p.id === action.toId)!,
      t,
    );
  if (action.type === "move" && action.playerId === owner.id)
    return path ? sampleMovementPath(path, t * t * (3 - 2 * t)) : owner;
  return owner;
}
type MovementObstacle = Position & { radius: number };
/** Shortest visible route around conservative swept defensive areas. */
export function planMovement(base: Board, action: MoveAction): Position[] | null {
  const mover = base.players.find((p) => p.id === action.playerId)!;
  const target = { x: action.targetX, y: action.targetY };
  if (distance(mover, target) < 0.01) return [mover, target];
  const owner = base.players.find((p) => p.id === base.possession)!;
  // Off-ball runs do not change the ball trajectory. Forecast the block's shift
  // first, then avoid the whole area each opponent occupies during the run.
  const forecast = mover.team === owner.team && mover.id !== owner.id
    ? simulateAction(base, {
        type: "highlight", playerIds: [owner.id],
        durationMs: action.durationMs, caption: "Forecast defensive movement",
      }).frames
    : [];
  const obstacles: MovementObstacle[] = base.players.filter((p) => p.team !== mover.team).map((p) => {
    const end = forecast.at(-1)?.board.players.find((q) => q.id === p.id) ?? p;
    const center = mix(p, end, 0.5);
    const radius = Math.max(distance(center, p), ...forecast.map((f) =>
      distance(center, f.board.players.find((q) => q.id === p.id)!),
    ));
    return { ...center, radius: MOVEMENT_CLEARANCE + 0.3 + radius };
  });
  const clear = (a: Position, b: Position) => obstacles.every((p) => {
    const initial = distance(p, a);
    // A board edit may start with overlapping pieces. Allow an off-ball runner
    // to leave an overlap monotonically; never let it cut through the obstacle.
    if (a === mover && initial < p.radius)
      return distance(p, b) > initial && laneDistance(p, a, b) >= initial - 1e-7;
    return laneDistance(p, a, b) >= p.radius - 1e-7;
  });
  if (obstacles.some((p) => distance(p, target) < p.radius)) return null;
  if (clear(mover, target)) return [mover, target];
  const nodes: Position[] = [mover, target];
  for (const p of obstacles) {
    // Circumscribed polygon: its chords stay outside the clearance circle.
    const radius = (p.radius + 0.1) / Math.cos(Math.PI / 12);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const point = { x: p.x + radius * Math.cos(angle), y: p.y + radius * Math.sin(angle) / 0.62 };
      if (point.x >= 4 && point.x <= 96 && point.y >= 4 && point.y <= 96 &&
          obstacles.every((o) => distance(o, point) >= o.radius)) nodes.push(point);
    }
  }
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1);
  const visited = new Set<number>();
  costs[0] = 0;
  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let nearest = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && (nearest < 0 || costs[i] < costs[nearest])) nearest = i;
    if (nearest < 0 || !Number.isFinite(costs[nearest])) return null;
    if (nearest === 1) {
      // Reject long tours of the pitch masquerading as a short repositioning.
      if (costs[1] > distance(mover, target) * 1.8 + 4) return null;
      const route: Position[] = [];
      for (let i = 1; i >= 0; i = previous[i]) route.unshift(nodes[i]);
      return route;
    }
    visited.add(nearest);
    for (let i = 0; i < nodes.length; i++) {
      const cost = costs[nearest] + distance(nodes[nearest], nodes[i]);
      if (!visited.has(i) && cost < costs[i] && clear(nodes[nearest], nodes[i])) {
        costs[i] = cost;
        previous[i] = nearest;
      }
    }
  }
  return null;
}
export function sampleMovementPath(path: Position[], progress: number): Position {
  const lengths = path.slice(1).map((p, i) => distance(path[i], p));
  let remaining = Math.max(0, Math.min(1, progress)) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) return mix(path[i], path[i + 1], lengths[i] ? remaining / lengths[i] : 0);
    remaining -= lengths[i];
  }
  return path.at(-1)!;
}
function movementLength(path: Position[]) {
  return path.slice(1).reduce((length, p, i) => length + distance(path[i], p), 0);
}
/** A model cannot evade tackles by teleporting the ball carrier to its target. */
export function prepareMove(board: Board, move: MoveAction): MoveAction {
  if (move.playerId !== board.possession) return move;
  const path = planMovement(board, move);
  if (!path) return move;
  // Smoothstep peaks at 1.5 times mean speed; account for the entire detour.
  const required = Math.ceil((1.5 * movementLength(path) / CARRY_SPEED) * 20) * 50;
  return { ...move, durationMs: Math.min(6000, Math.max(move.durationMs, required)) };
}
export function passDuration(
  board: Board,
  fromId: string,
  toId: string,
): number {
  const from = board.players.find((p) => p.id === fromId)!,
    to = board.players.find((p) => p.id === toId)!;
  return Math.max(
    1000,
    Math.min(2400, Math.ceil((distance(from, to) / BALL_SPEED) * 20) * 50),
  );
}
/** Exact relative segment check between ticks prevents a fast ball tunnelling past a defender. */
export function sweptBallDistance(
  ballBefore: Position,
  ballAfter: Position,
  defenderBefore: Position,
  defenderAfter: Position,
) {
  return laneDistance(
    { x: 0, y: 0 },
    { x: ballBefore.x - defenderBefore.x, y: ballBefore.y - defenderBefore.y },
    { x: ballAfter.x - defenderAfter.x, y: ballAfter.y - defenderAfter.y },
  );
}
/**
 * Conservative time-to-intercept envelope for every defender, independent of
 * the two displayed pressers and their shape-preserving movement caps.
 * After reacting, a defender can run directly to any future point on the pass.
 * Distance to a linear ball path minus growing reach is convex, so minimizing
 * it continuously catches crossings even between simulation frames.
 */
export function reachableInterceptors(
  base: Board,
  action: Extract<Action, { type: "pass" }>,
): string[] {
  const from = base.players.find((p) => p.id === action.fromId)!,
    to = base.players.find((p) => p.id === action.toId)!;
  const duration = action.durationMs / 1000;
  const delay = REACTION_DELAY_MS / 1000;
  return base.players
    .filter((p) => {
      if (p.team === from.team) return false;
      const margin = (time: number) =>
        distance(p, mix(from, to, Math.min(1, time / duration))) -
        PASS_LANE_CLEARANCE -
        INTERCEPT_SPEED * Math.max(0, time - delay);
      // Before the reaction delay, the defender can still stick out a foot.
      if (laneDistance(p, from, mix(from, to, Math.min(1, delay / duration))) <= PASS_LANE_CLEARANCE)
        return true;
      let low = Math.min(delay, duration), high = duration;
      for (let i = 0; i < 36; i++) {
        const a = low + (high - low) / 3,
          b = high - (high - low) / 3;
        if (margin(a) < margin(b)) high = b;
        else low = a;
      }
      return (
        margin((low + high) / 2) <= 0 ||
        // Receiving is not an instantaneous possession escape from a marker.
        margin(duration + FIRST_TOUCH_MS / 1000) <= 0
      );
    })
    .map((p) => p.id);
}
export function simulateAction(
  base: Board,
  action: Action,
): { frames: SimulationFrame[]; interceptorIds: string[]; movementBlocked: boolean; tacklerIds: string[]; movementPath: Position[] | null } {
  const owner = base.players.find((p) => p.id === base.possession)!;
  const movementPath = action.type === "move" ? planMovement(base, action) : null;
  let movementBlocked = action.type === "move" && !movementPath;
  if (action.type === "move" && action.playerId === owner.id && movementPath &&
      1.5 * movementLength(movementPath) / (action.durationMs / 1000) > CARRY_SPEED + 1e-7)
    movementBlocked = true;
  const tacklers = new Set<string>();
  // A separately scripted opposition response is an explicit move, not another automatic press.
  const reactive = !(
    action.type === "move" &&
    base.players.find((p) => p.id === action.playerId)!.team !== owner.team
  );
  const starts = new Map(base.players.map((p) => [p.id, p]));
  const frames: SimulationFrame[] = [
    { time: 0, board: base, ball: owner, pressingIds: [] },
  ];
  const interceptors = new Set<string>(
    action.type === "pass" ? reachableInterceptors(base, action) : [],
  );
  for (
    let time = Math.min(REACTION_STEP_MS, action.durationMs);
    ;
    time = Math.min(time + REACTION_STEP_MS, action.durationMs)
  ) {
    const previous = frames.at(-1)!;
    const previousPlayers = new Map(previous.board.players.map((p) => [p.id, p]));
    const dt = (time - previous.time) / 1000;
    const ball = actionBall(base, action, time, movementPath);
    const perceived = actionBall(
      base,
      action,
      Math.max(0, time - REACTION_DELAY_MS),
      movementPath,
    );
    const near = reactive
      ? previous.board.players
          .filter(
            (p) =>
              p.team !== owner.team &&
              p.role !== "GK" &&
              distance(p, perceived) < PRESS_RANGE,
          )
          .sort((a, b) => distance(a, perceived) - distance(b, perceived))
          .slice(0, 2)
      : [];
    const pressingIds = near.map((p) => p.id);
    let changed = false;
    let players = previous.board.players.map((p) => {
      const start = starts.get(p.id)!;
      if (action.type === "move" && action.playerId === p.id) {
        const t = time / action.durationMs;
        return {
          ...p,
          ...(movementPath ? sampleMovementPath(movementPath, t * t * (3 - 2 * t)) : start),
        };
      }
      if (!reactive || p.team === owner.team || p.role === "GK") return p;
      const rank = pressingIds.indexOf(p.id);
      const target =
        rank >= 0
          ? perceived
          : {
              x:
                start.x +
                Math.max(-1.4, Math.min(1.4, (perceived.x - start.x) * 0.035)),
              y:
                start.y +
                Math.max(-3, Math.min(3, (perceived.y - start.y) * 0.1)),
            };
      const speed =
        rank === 0 ? PRESS_SPEED : rank === 1 ? SUPPORT_SPEED : BLOCK_SPEED;
      const amount =
        rank >= 0
          ? Math.min(speed * dt, Math.max(0, distance(p, target) - MOVEMENT_CLEARANCE - 0.3))
          : speed * dt;
      // Cap the action's displacement so a short explanation preserves the team's broad shape.
      const next = toward(start, toward(p, target, amount), 6);
      const position = { x: clamp(next.x), y: clamp(next.y) };
      changed ||= distance(p, position) > 0.00001;
      return { ...p, ...position };
    });
    // Automatic pressers yield at contact rather than walking through a player.
    // Test relative segments, not only frame endpoints, so paths cannot cross
    // between rendered samples. Explicit runs get validated below as well.
    const proposed = players;
    players = proposed.map((p) => {
      if (p.team === owner.team || !reactive || p.role === "GK") return p;
      const before = previousPlayers.get(p.id)!;
      const travel = distance(before, p);
      if (travel < 1e-8) return p;
      const collides = proposed.some((q) => {
        if (q.team === p.team) return false;
        const qBefore = previousPlayers.get(q.id)!;
        const gap = distance(before, qBefore);
        if (gap > MOVEMENT_CLEARANCE + travel + distance(qBefore, q)) return false;
        return sweptBallDistance(before, p, qBefore, q) < Math.min(MOVEMENT_CLEARANCE, gap) - 1e-7;
      });
      return collides ? before : p;
    });
    const defendingTeam = owner.team === "tottenham" ? "arsenal" : "tottenham";
    const board: Board = {
      ...previous.board,
      players,
      possession:
        action.type === "pass" && time === action.durationMs
          ? action.toId
          : base.possession,
      custom: {
        ...previous.board.custom,
        ...(action.type === "move"
          ? { [starts.get(action.playerId)!.team]: true }
          : {}),
        ...(changed ? { [defendingTeam]: true } : {}),
      },
    };
    if (action.type === "pass")
      for (const p of players) {
        if (
          p.team !== owner.team &&
          sweptBallDistance(
            previous.ball,
            ball,
            previousPlayers.get(p.id)!,
            p,
          ) < PASS_LANE_CLEARANCE
        )
          interceptors.add(p.id);
      }
    if (action.type === "move") {
      const before = previousPlayers.get(action.playerId)!;
      const after = players.find((p) => p.id === action.playerId)!;
      for (const opponent of players.filter((p) => p.team !== after.team)) {
        const opponentBefore = previousPlayers.get(opponent.id)!;
        const initialGap = distance(before, opponentBefore);
        if (sweptBallDistance(before, after, opponentBefore, opponent) < Math.min(MOVEMENT_CLEARANCE, initialGap) - 1e-7)
          movementBlocked = true;
        if (action.playerId === owner.id) {
          const start = starts.get(opponent.id)!;
          // The defender can attack any part of the dribble, irrespective of
          // their displayed pressing assignment. Using the end-of-tick reach
          // for the whole segment is conservative by at most 0.3 pitch units.
          const reach = PASS_LANE_CLEARANCE + INTERCEPT_SPEED * Math.max(0, (time - REACTION_DELAY_MS) / 1000);
          if (laneDistance(start, previous.ball, ball) <= reach ||
              sweptBallDistance(previous.ball, ball, opponentBefore, opponent) <= PASS_LANE_CLEARANCE)
            tacklers.add(opponent.id);
        }
      }
    }
    frames.push({ time, board, ball, pressingIds });
    if (time === action.durationMs) break;
  }
  return { frames, interceptorIds: [...interceptors], movementBlocked, tacklerIds: [...tacklers], movementPath };
}
export function compileSequence(base: Board, actions: Action[]) {
  let board = base,
    start = 0;
  const steps = actions.map((action) => {
    const simulation = simulateAction(board, action);
    const step = { action, start, frames: simulation.frames, movementPath: simulation.movementPath };
    board = simulation.frames.at(-1)!.board;
    start += action.durationMs;
    return step;
  });
  return { base, steps, finalBoard: board, duration: start };
}
export function sampleTimeline(
  timeline: ReturnType<typeof compileSequence>,
  elapsed: number,
) {
  const time = Math.max(0, elapsed);
  const index = timeline.steps.findIndex(
    (s) => time < s.start + s.action.durationMs,
  );
  if (index < 0)
    return {
      board: timeline.finalBoard,
      ball: timeline.finalBoard.players.find(
        (p) => p.id === timeline.finalBoard.possession,
      )!,
      index: timeline.steps.length,
      caption: timeline.steps.at(-1)?.action.caption ?? "",
      activeIds: [] as string[],
      pressingIds: [] as string[],
    };
  const step = timeline.steps[index],
    local = time - step.start;
  const frameIndex = Math.min(
    Math.floor(local / REACTION_STEP_MS),
    step.frames.length - 2,
  );
  const a = step.frames[frameIndex],
    b = step.frames[frameIndex + 1];
  const t = (local - a.time) / (b.time - a.time);
  const board = {
    ...a.board,
    players: a.board.players.map((p, i) => ({
      ...p,
      ...mix(p, b.board.players[i], t),
    })),
  };
  const action = step.action;
  return {
    board,
    ball: mix(a.ball, b.ball, t),
    index,
    caption: action.caption,
    activeIds:
      action.type === "highlight"
        ? action.playerIds
        : [action.type === "move" ? action.playerId : action.toId],
    pressingIds: t > 0 ? b.pressingIds : a.pressingIds,
  };
}
/** Pure sampling: scrubbing and replay always rebuild exactly the same defending positions. */
export function sampleSequence(
  base: Board,
  actions: Action[],
  elapsed: number,
) {
  return sampleTimeline(compileSequence(base, actions), elapsed);
}
export type History = {
  board: Board;
  past: { board: Board; label: string }[];
  future: { board: Board; label: string }[];
};
export type HistoryAction =
  | { type: "commit"; board: Board; label: string }
  | { type: "live"; board: Board }
  | { type: "gesture"; before: Board }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; board: Board };
export function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === "reset")
    return { board: action.board, past: [], future: [] };
  if (action.type === "live") return { ...state, board: action.board };
  if (action.type === "commit" || action.type === "gesture") {
    const before = action.type === "gesture" ? action.before : state.board,
      after = action.type === "gesture" ? state.board : action.board;
    if (JSON.stringify(before) === JSON.stringify(after)) return state;
    return {
      board: after,
      past: [
        ...state.past,
        {
          board: before,
          label: action.type === "gesture" ? "Move player" : action.label,
        },
      ].slice(-40),
      future: [],
    };
  }
  if (action.type === "undo") {
    const entry = state.past.at(-1);
    if (!entry) return state;
    return {
      board: entry.board,
      past: state.past.slice(0, -1),
      future: [{ board: state.board, label: entry.label }, ...state.future],
    };
  }
  const entry = state.future[0];
  if (!entry) return state;
  return {
    board: entry.board,
    past: [...state.past, { board: state.board, label: entry.label }],
    future: state.future.slice(1),
  };
}
/** Metric uses nominal pitch proportions (length 100, width 62). It is an illustrative geometry heuristic. */
export const PASS_LANE_CLEARANCE = 4;
export function distance(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, (a.y - b.y) * 0.62);
}
export function laneDistance(p: Position, a: Position, b: Position) {
  const dx = b.x - a.x,
    dy = (b.y - a.y) * 0.62,
    length = dx * dx + dy * dy;
  const t = length
    ? Math.max(
        0,
        Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * 0.62 * dy) / length),
      )
    : 0;
  return distance(p, { x: a.x + t * dx, y: a.y + t * (b.y - a.y) });
}
/** Shared by overlays, sequence validation and routing. Includes pressure at both endpoints. */
export function staticPassLane(board: Board, fromId: string, toId: string) {
  const from = board.players.find((p) => p.id === fromId),
    to = board.players.find((p) => p.id === toId);
  if (
    !from ||
    !to ||
    from.id === to.id ||
    from.team !== to.team ||
    distance(from, to) < 1
  )
    return { blocked: true, blockerIds: [] as string[] };
  const blockerIds = board.players
    .filter(
      (p) =>
        p.team !== from.team && laneDistance(p, from, to) < PASS_LANE_CLEARANCE,
    )
    .map((p) => p.id);
  return { blocked: blockerIds.length > 0, blockerIds };
}

/** Same conservative forecast for overlays, routing and validation. */
export function passLane(board: Board, fromId: string, toId: string) {
  const lane = staticPassLane(board, fromId, toId);
  if (lane.blocked) return { ...lane, reason: "lane" as const };
  const from = board.players.find((p) => p.id === fromId)!,
    to = board.players.find((p) => p.id === toId)!;
  if (distance(from, to) > BALL_SPEED * 2.4)
    return {
      blocked: true,
      blockerIds: [] as string[],
      reason: "distance" as const,
    };
  const forecast: Extract<Action, { type: "pass" }> = {
      type: "pass",
      fromId,
      toId,
      durationMs: passDuration(board, fromId, toId),
      caption: "Pass forecast",
  };
  const reachable = reachableInterceptors(board, forecast);
  if (reachable.length)
    return { blocked: true, blockerIds: reachable, reason: "reaction" as const };
  const simulation = simulateAction({ ...board, possession: fromId }, forecast);
  return {
    blocked: simulation.interceptorIds.length > 0,
    blockerIds: simulation.interceptorIds,
    reason: "reaction" as const,
  };
}
/** Bounded stateful search: reaching the same teammate after circulation can draw a different press. */
export function findPassingRoute(
  board: Board,
  toId: string,
  maxPasses: number,
): string[] | null {
  const owner = board.players.find((p) => p.id === board.possession),
    target = board.players.find((p) => p.id === toId);
  if (!owner || !target || owner.team !== target.team) return null;
  if (owner.id === toId) return [];
  const teammates = board.players.filter((p) => p.team === owner.team);
  let frontier = [{ board, path: [] as string[], length: 0 }];
  for (let depth = 0; depth < Math.min(4, maxPasses); depth++) {
    const next: typeof frontier = [];
    for (const state of frontier) {
      const fromId = state.board.possession;
      const from = state.board.players.find((p) => p.id === fromId)!;
      for (const receiver of [...teammates].sort(
        (a, b) => distance(a, target) - distance(b, target),
      )) {
        if (
          receiver.id === fromId ||
          passLane(state.board, fromId, receiver.id).blocked
        )
          continue;
        const path = [...state.path, receiver.id];
        if (receiver.id === toId) return path;
        const advanced = applyAction(state.board, {
          type: "pass",
          fromId,
          toId: receiver.id,
          durationMs: passDuration(state.board, fromId, receiver.id),
          caption: "Recycle to draw pressure",
        });
        next.push({
          board: advanced,
          path,
          length: state.length + distance(from, receiver),
        });
      }
    }
    // Keep the search small and favor short supporting routes, not repeated full-pitch switches.
    frontier = next.sort((a, b) => a.length - b.length).slice(0, 24);
    if (!frontier.length) break;
  }
  return null;
}

export function passingOptions(board: Board) {
  const owner = board.players.find((p) => p.id === board.possession)!;
  return board.players
    .filter((p) => p.team === owner.team && p.id !== owner.id)
    .sort((a, b) => distance(owner, a) - distance(owner, b))
    .slice(0, 4)
    .map((p) => ({
      player: p,
      blocked: passLane(board, owner.id, p.id).blocked,
    }));
}
export function convexHull(players: Player[]): Position[] {
  const points = [...players].sort((a, b) => a.x - b.x || a.y - b.y);
  if (points.length < 3) return points;
  const cross = (o: Position, a: Position, b: Position) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (pts: Position[]) => {
    const result: Position[] = [];
    for (const p of pts) {
      while (
        result.length >= 2 &&
        cross(result.at(-2)!, result.at(-1)!, p) <= 0
      )
        result.pop();
      result.push(p);
    }
    return result;
  };
  return [...half(points).slice(0, -1), ...half(points.reverse()).slice(0, -1)];
}
