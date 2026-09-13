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
    durationMs,
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
export function applyAction(board: Board, action: Action): Board {
  if (action.type === "move")
    return movePlayer(board, action.playerId, {
      x: action.targetX,
      y: action.targetY,
    });
  if (action.type === "pass") return { ...board, possession: action.toId };
  return board;
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
      if (passLane(current, fromId, toId).blocked)
        throw new Error("Pass crosses a blocked lane");
      meaningful = true;
    } else action.playerIds.forEach(player);
    current = applyAction(current, action);
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
    current = applyAction(current, move);
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
/** Sampling is pure: a paused clock freezes both the players AND a ball mid-pass. */
export function sampleSequence(
  base: Board,
  actions: Action[],
  elapsed: number,
): {
  board: Board;
  ball: Position;
  index: number;
  caption: string;
  activeIds: string[];
} {
  let board = base,
    remaining = Math.max(0, elapsed),
    index = 0;
  for (const action of actions) {
    if (remaining >= action.durationMs) {
      board = applyAction(board, action);
      remaining -= action.durationMs;
      index++;
      continue;
    }
    const progress = remaining / action.durationMs;
    const t = progress * progress * (3 - 2 * progress);
    const owner = board.players.find((p) => p.id === board.possession)!;
    let ball: Position = owner;
    if (action.type === "move") {
      const p = board.players.find((p) => p.id === action.playerId)!;
      board = {
        ...board,
        players: board.players.map((q) =>
          q.id === p.id
            ? {
                ...q,
                x: p.x + (action.targetX - p.x) * t,
                y: p.y + (action.targetY - p.y) * t,
              }
            : q,
        ),
      };
      ball = board.players.find((p) => p.id === board.possession)!;
    } else if (action.type === "pass") {
      const from = board.players.find((p) => p.id === action.fromId)!,
        to = board.players.find((p) => p.id === action.toId)!;
      ball = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      };
    }
    return {
      board,
      ball,
      index,
      caption: action.caption,
      activeIds:
        action.type === "highlight"
          ? action.playerIds
          : action.type === "move"
            ? [action.playerId]
            : [action.toId],
    };
  }
  return {
    board,
    ball: board.players.find((p) => p.id === board.possession)!,
    index,
    caption: actions.at(-1)?.caption ?? "",
    activeIds: [],
  };
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
export function passLane(board: Board, fromId: string, toId: string) {
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

/** Fewest-pass open route to an intended receiver, bounded by the remaining action budget. */
export function findPassingRoute(
  board: Board,
  toId: string,
  maxPasses: number,
): string[] | null {
  const owner = board.players.find((p) => p.id === board.possession),
    target = board.players.find((p) => p.id === toId);
  if (!owner || !target || owner.team !== target.team) return null;
  if (owner.id === toId) return [];
  const teammates = board.players
    .filter((p) => p.team === owner.team)
    .sort((a, b) => distance(a, target) - distance(b, target));
  const queue: string[][] = [[owner.id]],
    visited = new Set([owner.id]);
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    if (path.length > Math.min(4, maxPasses)) continue;
    for (const next of teammates) {
      if (
        visited.has(next.id) ||
        passLane(board, path.at(-1)!, next.id).blocked
      )
        continue;
      const route = [...path, next.id];
      if (next.id === toId) return route.slice(1);
      visited.add(next.id);
      queue.push(route);
    }
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
