import {
  type Analysis,
  type Player,
  type ScenarioId,
  clamp,
  validateAnalysis,
} from "./tactics";

/** Deterministic scenario coaching. Targets follow the current teammates after manual edits.
 * This is a curated structural suggestion, not a free-form answer to arbitrary questions. */
export function fallbackAnalysis(
  scenario: ScenarioId,
  players: Player[],
): Analysis {
  const get = (id: string) => {
    const player = players.find((p) => p.id === id && p.team === "tottenham");
    if (!player) throw new Error("Incomplete board");
    return player;
  };
  const lcb = get("lcb"),
    rcb = get("rcb"),
    dm = get("dm");
  const edited =
    scenario === "press" &&
    (Math.abs(lcb.x - 25) > 6 ||
      Math.abs(rcb.x - 25) > 6 ||
      Math.abs(lcb.y - 33) > 8 ||
      Math.abs(rcb.y - 67) > 8);
  const analyses: Record<ScenarioId, Analysis> = {
    press: {
      headline: "Create a 3v2 in the first line",
      diagnosis: edited
        ? "Build a spare-player option around your repositioned center backs. Dropping the DM between them can give the first line an extra outlet against two forwards."
        : "Arsenal’s two forwards are matching Tottenham’s two center backs, taking away the spare player in the first buildup line.",
      principle: "Create a free player in the first phase of buildup.",
      recommendation: {
        playerId: "dm",
        instruction: "Drop the defensive midfielder between the center backs.",
        targetX: (lcb.x + rcb.x) / 2,
        targetY: (lcb.y + rcb.y) / 2,
      },
      whyItWorks: [
        "Creates a 3v2 against the first pressing line",
        "Gives either center back a free-player outlet",
        "Forces Arsenal’s midfield to decide whether to jump",
      ],
      risk: "Less midfield occupation if possession is lost. Keep the next pass away from central pressure.",
      opponentCounter:
        "Arsenal can push a central midfielder toward the dropping DM to restore a 3v3 press. The space that midfielder leaves becomes the next passing target.",
      beforeLabel: "2v2 first line",
      afterLabel: "3v2 overload",
    },
    block: {
      headline: "Find the gap in the half-space",
      diagnosis:
        "Arsenal’s narrow defensive lines protect the center. A winger moving inside can give the fullback and center back a difficult handover.",
      principle:
        "Occupy the space between defenders to create a local overload.",
      recommendation: {
        playerId: "lw",
        instruction:
          "Bring the left winger inside, between Arsenal’s fullback and center back.",
        targetX: 81,
        targetY: 27,
      },
      whyItWorks: [
        "Adds a receiving option between the lines",
        "Creates a local combination with the left midfielder",
        "Opens the outside lane for the advancing left back",
      ],
      risk: "Moving inside reduces natural width. The left back must be ready to provide it.",
      opponentCounter:
        "Arsenal can tuck the fullback inside and ask a wide midfielder to track the overlap. Switch play before the block can slide across.",
      beforeLabel: "Winger outside the block",
      afterLabel: "Half-space overload",
    },
    lead: {
      headline: "Secure the center with a double pivot",
      diagnosis:
        "Both central midfielders are ahead of the DM. A turnover can leave one player protecting the space in front of the center backs.",
      principle:
        "Keep a second player behind the ball to protect the transition.",
      recommendation: {
        playerId: "rcm",
        instruction: "Drop the right central midfielder alongside the DM.",
        targetX: dm.x + 2,
        targetY: clamp(dm.y + (dm.y > 65 ? -18 : 18)),
      },
      whyItWorks: [
        "Adds a second screen in front of the defense",
        "Gives the ball carrier a safer recycling option",
        "Keeps cover when one pivot steps toward the ball",
      ],
      risk: "One fewer player supports the attack. The striker can become isolated if the team drops too deep.",
      opponentCounter:
        "Arsenal can spread its midfield and move the ball wide to pull the double pivot apart. Shift together and protect the inside passing lane.",
      beforeLabel: "Single midfield screen",
      afterLabel: "Double-pivot cover",
    },
  };
  return validateAnalysis(analyses[scenario], players);
}
