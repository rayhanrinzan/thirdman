import { clamp } from "./tactics";
import {
  applyActions,
  findPassingRoute,
  validateSequence,
  type Board,
  type Action,
  type MoveAction,
  type AnalysisResult,
  type LabRequest,
  type Sequence,
} from "./lab";
export const explorations = [
  { label: "Free player", question: "How can we create a free player?" },
  {
    label: "Invert fullback",
    question: "What changes if my fullback inverts?",
  },
  { label: "Overlap", question: "Can we use an overlap on the left?" },
  { label: "Double pivot", question: "How can a double pivot protect us?" },
] as const;
type Intent = "press" | "invert" | "overlap" | "pivot" | "halfspace";
export function detectIntent(
  question: string,
  scenario: LabRequest["scenario"],
): Intent | null {
  const q = question.toLowerCase();
  if (/invert|inversion/.test(q)) return "invert";
  if (/overlap|outside lane/.test(q)) return "overlap";
  if (/pivot|protect|lead|exposed|lose the ball|rest defen/.test(q))
    return "pivot";
  if (/half.?space|low block|between the lines/.test(q)) return "halfspace";
  if (
    /press|free (player|man)|overload|buildup|build.up|midfielder jumps/.test(q)
  )
    return scenario === "block"
      ? "halfspace"
      : scenario === "lead"
        ? "pivot"
        : "press";
  return null;
}
const move = (
  playerId: string,
  x: number,
  y: number,
  caption: string,
): MoveAction => ({
  type: "move",
  playerId,
  targetX: clamp(x),
  targetY: clamp(y),
  caption,
  durationMs: 1400,
});
function distinctMove(board: Board, action: MoveAction): MoveAction {
  const p = board.players.find((p) => p.id === action.playerId)!;
  if (Math.hypot(p.x - action.targetX, p.y - action.targetY) < 1)
    return {
      ...action,
      targetY: clamp(p.y + (p.y > 60 ? -8 : 8)),
      caption:
        "Stagger the support position to open a different passing angle.",
    };
  return action;
}
export function curatedAnalysis(input: LabRequest): AnalysisResult {
  const intent = detectIntent(input.question, input.scenario);
  if (!intent)
    return {
      analysis: null,
      source: "fallback",
      notice:
        "This question needs live AI analysis. Try a supported exploration below: free player, inverted fullback, overlap, or double pivot.",
    };
  const b = input.board,
    get = (id: string) => b.players.find((p) => p.id === id)!;
  const lcb = get("lcb"),
    rcb = get("rcb"),
    dm =
      b.players.find(
        (p) => p.team === "tottenham" && ["DM", "LDM", "RDM"].includes(p.role),
      ) || get("dm"),
    lb = get("lb"),
    wing = get("lw");
  const canonical =
    !b.custom.tottenham &&
    !b.custom.arsenal &&
    b.formations.tottenham === "4–3–3" &&
    b.formations.arsenal === "4–4–2";
  let sequence: Sequence;
  let route: string[];
  let actions: Action[];
  if (intent === "press") {
    actions = [
      distinctMove(
        b,
        move(
          dm.id,
          (lcb.x + rcb.x) / 2,
          (lcb.y + rcb.y) / 2,
          `The ${dm.role} drops between the center backs, adding a spare player.`,
        ),
      ),
    ];
    route = ["lcb", dm.id, "rcb"];
    sequence = {
      headline: "Make the spare player",
      diagnosis: !canonical
        ? "Explore an extra outlet around your current center backs. Check whether the two forwards can still cover all three receivers."
        : "Two forwards can match two center backs. Bring a third player into the first line and give the press a decision.",
      objective: "Create a 3v2, then circulate through the free player.",
      tradeoff:
        "The DM leaves space in midfield. A central turnover can expose the next line.",
      beforeLabel: !canonical ? "Your starting shape" : "2v2 first line",
      afterLabel: "Extra first-line outlet",
      actions,
      opponent: {
        explanation:
          "One possible response: Arsenal sends a midfielder toward the DM. That closes the spare player but vacates space higher up the pitch.",
        movements: [
          move(
            "ars-dm",
            (lcb.x + rcb.x) / 2 + 9,
            (lcb.y + rcb.y) / 2,
            "Arsenal’s midfielder steps toward the dropping DM.",
          ),
        ],
        space: {
          x: get("ars-dm").x,
          y: get("ars-dm").y,
          label: "Space behind the jumping midfielder",
        },
        outletPlayerId: "lcm",
      },
    };
    if (canonical) sequence.afterLabel = "3v2 first-line overload";
  } else if (intent === "invert") {
    actions = [
      distinctMove(
        b,
        move(
          "lb",
          dm.x + 3,
          dm.y - 16,
          "The left back moves inside to support the holding midfielder.",
        ),
      ),
    ];
    route = ["lcb", "lb", "lcm"];
    sequence = {
      headline: "Turn the fullback into an inside outlet",
      diagnosis:
        "An inward fullback movement can offer a diagonal pass from the center back and another player around the ball.",
      objective:
        "Connect the back line to midfield through an inverted fullback.",
      tradeoff:
        "The left touchline loses its natural outlet. The winger must preserve width.",
      beforeLabel: "Fullback outside",
      afterLabel: "Extra midfield connection",
      actions,
      opponent: {
        explanation:
          "Arsenal’s wide midfielder could track the fullback inside. The outside lane is then available to the winger.",
        movements: [
          move(
            "ars-lw",
            dm.x + 11,
            dm.y - 16,
            "The wide midfielder follows the inverted fullback.",
          ),
        ],
        space: { x: lb.x + 15, y: 12, label: "Outside lane opens" },
        outletPlayerId: "lw",
      },
    };
  } else if (intent === "overlap") {
    const targetX = clamp(Math.max(wing.x, lb.x + 15));
    actions = [
      distinctMove(
        b,
        move(
          "lw",
          wing.x - 3,
          27,
          "The winger moves inside, inviting the fullback to narrow.",
        ),
      ),
      distinctMove(
        b,
        move(
          "lb",
          targetX,
          10,
          "The left back overlaps into the outside lane.",
        ),
      ),
    ];
    route = ["lcm", "lw", "lb"];
    sequence = {
      headline: "Go inside to open the outside",
      diagnosis:
        "Move the winger into the half-space and send the left back beyond. The defender has two different runs to account for.",
      objective: "Combine inside, then release the overlapping fullback.",
      tradeoff:
        "The left back commits forward. The remaining defenders must cover a turnover on that side.",
      beforeLabel: "Shared outside lane",
      afterLabel: "Inside–outside combination",
      actions,
      opponent: {
        explanation:
          "Arsenal can send a wide midfielder out to track the overlap. That can open a connection back into the half-space.",
        movements: [
          move(
            "ars-lw",
            targetX - 6,
            15,
            "Arsenal’s wide midfielder tracks the overlap.",
          ),
        ],
        space: {
          x: wing.x - 4,
          y: 32,
          label: "Inside connection after the shift",
        },
        outletPlayerId: "lcm",
      },
    };
  } else if (intent === "halfspace") {
    actions = [
      distinctMove(
        b,
        move(
          "lw",
          clamp(Math.max(wing.x, 72) + 4),
          27,
          "The winger arrives between the opposition fullback and center back.",
        ),
      ),
    ];
    route = ["lw", "lcm", "lb"];
    sequence = {
      headline: "Connect through the half-space",
      diagnosis:
        "A narrow block protects the center. An inside winger offers a short combination while the left back stays wide.",
      objective: "Combine between the lines, then find the outside outlet.",
      tradeoff:
        "The inside receiver can be crowded out. Keep the return pass and the wide outlet available.",
      beforeLabel: "Winger outside the block",
      afterLabel: "Half-space connection",
      actions,
      opponent: {
        explanation:
          "The fullback could tuck inside to follow the winger. A pass to the left back then tests the vacated outside lane.",
        movements: [
          move(
            "ars-lb",
            get("ars-lb").x - 4,
            30,
            "The fullback narrows to track the winger.",
          ),
        ],
        space: { x: 80, y: 12, label: "Wide outlet beyond the narrow block" },
        outletPlayerId: "lb",
      },
    };
  } else {
    actions = [
      distinctMove(
        b,
        move(
          "rcm",
          dm.x + 2,
          dm.y + (dm.y > 65 ? -18 : 18),
          "The right midfielder drops alongside the DM for a double pivot.",
        ),
      ),
    ];
    route = ["dm", "lcb", "rcb"];
    sequence = {
      headline: "Keep two players behind the ball",
      diagnosis:
        "A second deeper midfielder adds a recycling option and shares responsibility for the space in front of the defense.",
      objective: "Build a double pivot and circulate away from pressure.",
      tradeoff:
        "One fewer player supports the striker. Avoid dropping the whole team so deep that the next pass disappears.",
      beforeLabel: "Single midfield screen",
      afterLabel: "Double-pivot cover",
      actions,
      opponent: {
        explanation:
          "Arsenal could move a midfielder wider to draw one pivot out. Keep the central connection available instead of following every run.",
        movements: [
          move(
            "ars-lcm",
            dm.x + 14,
            18,
            "Arsenal’s midfielder widens to stretch the double pivot.",
          ),
        ],
        space: {
          x: dm.x + 18,
          y: 45,
          label: "Central lane behind the wide movement",
        },
        outletPlayerId: "lcm",
      },
    };
  }
  const ownsBall = get(b.possession).team === "tottenham";
  let rerouted = false,
    omitted = false;
  if (ownsBall) {
    let passCount = 0;
    const reached = new Set<string>();
    for (const to of route) {
      if (reached.has(to)) continue;
      const current = applyActions(b, actions);
      const path = findPassingRoute(current, to, 4 - passCount);
      if (!path) {
        omitted = true;
        continue;
      }
      rerouted ||= path.length > 1;
      for (const receiver of path) {
        const state = applyActions(b, actions);
        const from = state.players.find((p) => p.id === state.possession)!,
          dest = state.players.find((p) => p.id === receiver)!;
        actions.push({
          type: "pass",
          fromId: from.id,
          toId: dest.id,
          durationMs: 1000,
          caption: `${from.role} finds ${dest.role} through an open lane.${path.length > 1 ? " Recycle around the blocked direct route." : ""}`,
        });
        passCount++;
        reached.add(receiver);
      }
    }
  }
  sequence.actions = actions;
  sequence.opponent.movements = sequence.opponent.movements.map((a) =>
    distinctMove(applyActions(b, actions), a),
  );
  return {
    analysis: validateSequence(sequence, b),
    source: "fallback",
    notice: ownsBall
      ? omitted
        ? "Some intended connections have no open route within this short sequence. Only open passes are shown; adjust the support positions to connect further."
        : rerouted
          ? "The direct route is blocked. This sequence recycles through an open supporting lane."
          : null
      : "Arsenal has the ball. This guide shows the shape change only; give Tottenham possession to explore the passing sequence.",
  };
}
