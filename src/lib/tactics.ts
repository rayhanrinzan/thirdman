/** Landscape pitch: x increases toward Arsenal's goal (left → right); y increases top → bottom.
 * Tottenham always attacks +x. Coordinates are percentages of the playing surface, never pixels. */
export type Position = { x: number; y: number };
export type Player = Position & {
  id: string;
  role: string;
  team: "tottenham" | "arsenal";
};
export const scenarioIds = ["press", "block", "lead"] as const;
export type ScenarioId = (typeof scenarioIds)[number];
export const SAFE_MIN = 4;
export const SAFE_MAX = 96;
export const clamp = (n: number) =>
  Math.min(SAFE_MAX, Math.max(SAFE_MIN, Number.isFinite(n) ? n : 50));
export const scenarios = {
  press: {
    name: "Beat the press",
    description: "Find the spare player. Play through the first line.",
    userFormation: "4–3–3",
    opponentFormation: "4–4–2",
    phase: "FIRST-PHASE BUILDUP",
    question: "How do we beat this press?",
  },
  block: {
    name: "Break a low block",
    description: "Stretch the block. Open the space between the lines.",
    userFormation: "4–3–3",
    opponentFormation: "4–5–1",
    phase: "FINAL-THIRD POSSESSION",
    question: "How can we break down this low block?",
  },
  lead: {
    name: "Protect a lead",
    description: "Control the space. Be ready for the transition.",
    userFormation: "4–3–3",
    opponentFormation: "4–3–3",
    phase: "DEFENSIVE TRANSITION",
    question: "How can we protect our lead?",
  },
} satisfies Record<
  ScenarioId,
  {
    name: string;
    description: string;
    userFormation: string;
    opponentFormation: string;
    phase: string;
    question: string;
  }
>;

const roles = [
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
];
const shapes: Record<ScenarioId, { home: number[][]; away: number[][] }> = {
  press: {
    home: [
      [8, 50],
      [32, 12],
      [25, 33],
      [25, 67],
      [32, 88],
      [43, 50],
      [53, 27],
      [53, 73],
      [69, 12],
      [73, 50],
      [69, 88],
    ],
    away: [
      [94, 50],
      [80, 14],
      [84, 38],
      [84, 62],
      [80, 86],
      [62, 38],
      [62, 62],
      [51, 88],
      [51, 12],
      [36, 34],
      [36, 66],
    ],
  },
  block: {
    home: [
      [8, 50],
      [52, 13],
      [38, 36],
      [38, 64],
      [52, 87],
      [53, 50],
      [67, 33],
      [67, 67],
      [77, 8],
      [81, 50],
      [77, 92],
    ],
    away: [
      [95, 50],
      [85, 18],
      [88, 39],
      [88, 61],
      [85, 82],
      [76, 50],
      [74, 32],
      [74, 68],
      [70, 13],
      [60, 50],
      [70, 87],
    ],
  },
  lead: {
    home: [
      [8, 50],
      [29, 14],
      [24, 35],
      [24, 65],
      [29, 86],
      [40, 44],
      [58, 31],
      [60, 66],
      [68, 12],
      [72, 50],
      [68, 88],
    ],
    away: [
      [94, 50],
      [75, 15],
      [82, 36],
      [82, 64],
      [75, 85],
      [66, 50],
      [53, 29],
      [53, 71],
      [39, 12],
      [37, 50],
      [39, 88],
    ],
  },
};
export function initialPlayers(scenario: ScenarioId): Player[] {
  return (["tottenham", "arsenal"] as const).flatMap((team) => {
    const coordinates =
      team === "tottenham" ? shapes[scenario].home : shapes[scenario].away;
    return coordinates.map(([x, y], i) => ({
      id: `${team === "arsenal" ? "ars-" : ""}${roles[i].toLowerCase()}`,
      role:
        scenario === "press" && team === "arsenal"
          ? [
              "GK",
              "LB",
              "LCB",
              "RCB",
              "RB",
              "LCM",
              "RCM",
              "RM",
              "LM",
              "ST",
              "ST",
            ][i]
          : roles[i],
      team,
      x,
      y,
    }));
  });
}
