"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import { MotionConfig, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CornerDownLeft,
  HelpCircle,
  LoaderCircle,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  SkipBack,
  SkipForward,
  Undo2,
  X,
} from "lucide-react";
import Pitch, { type Overlay } from "./pitch";
import { useTimeline } from "./use-timeline";
import {
  scenarios,
  scenarioIds,
  type ScenarioId,
  type Position,
} from "@/lib/tactics";
import {
  applyActions,
  changeFormation,
  createBoard,
  formationNames,
  historyReducer,
  movePlayer,
  sampleSequence,
  totalDuration,
  validateSequence,
  type AnalysisResult,
  type Board,
  type Formation,
  type LabRequest,
  type MoveAction,
  type Sequence,
  type Team,
} from "@/lib/lab";
import { curatedAnalysis, explorations } from "@/lib/curated";
type Session = {
  analysis: Sequence;
  source: AnalysisResult["source"];
  base: Board;
};
type Phase = "original" | "adjusted" | "response";
const teamName = (team: Team) =>
  team === "tottenham" ? "Tottenham" : "Arsenal";
export default function Sandbox() {
  const [scenario, setScenario] = useState<ScenarioId>("press");
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({
    board: createBoard("press"),
    past: [],
    future: [],
  }));
  const [team, setTeam] = useState<Team>("tottenham"),
    [selected, setSelected] = useState<string | null>(null),
    [overlay, setOverlay] = useState<Overlay>("none");
  const [question, setQuestion] = useState("How can we create a free player?"),
    [loading, setLoading] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [phase, setPhase] = useState<Phase>("adjusted"),
    [applied, setApplied] = useState(0),
    [explored, setExplored] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const request = useRef<AbortController | null>(null),
    version = useRef(0),
    gesture = useRef<Board | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    help = useRef<HTMLButtonElement>(null),
    workspace = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const actions = session
    ? phase === "response"
      ? session.analysis.opponent.movements
      : phase === "original"
        ? []
        : session.analysis.actions
    : [];
  const duration = totalDuration(actions),
    timeline = useTimeline(duration);
  const adjusted = session
    ? applyActions(session.base, session.analysis.actions)
    : history.board;
  const base = session
    ? phase === "response"
      ? adjusted
      : session.base
    : history.board;
  const sample = sampleSequence(base, actions, timeline.time);
  const displayed = session ? sample.board : history.board;
  const owner = displayed.players.find((p) => p.id === displayed.possession)!;
  const selection = displayed.players.find((p) => p.id === selected);
  const ghosts: MoveAction[] =
    session && phase !== "original" && timeline.time === 0
      ? actions.filter((a): a is MoveAction => a.type === "move")
      : [];
  const completed =
    !!session && phase !== "original" && timeline.time >= duration;
  const hasInspector = !!session || !!selection;
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!session || !window.matchMedia("(max-width: 760px)").matches) return;
    const frame = requestAnimationFrame(() =>
      workspace.current?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [session]);
  function clearPreview() {
    version.current++;
    request.current?.abort();
    setLoading(false);
    timeline.stop();
    setSession(null);
    setApplied(0);
    setExplored(false);
    setPhase("adjusted");
    setNotice(null);
    setAnnouncement("");
  }
  function commit(board: Board, label: string) {
    clearPreview();
    dispatch({ type: "commit", board, label });
  }
  function reset(id: ScenarioId = scenario) {
    clearPreview();
    setScenario(id);
    dispatch({ type: "reset", board: createBoard(id) });
    setTeam("tottenham");
    setSelected(null);
    setOverlay("none");
    setQuestion(
      id === "press" ? explorations[0].question : scenarios[id].question,
    );
  }
  function undo() {
    clearPreview();
    setSelected(null);
    dispatch({ type: "undo" });
  }
  function redo() {
    clearPreview();
    setSelected(null);
    dispatch({ type: "redo" });
  }
  function keyMove(id: string, position: Position) {
    commit(movePlayer(history.board, id, position), "Move player");
  }
  async function analyze(text = question) {
    if (!text.trim() || loading) return;
    clearPreview();
    setSelected(null);
    setQuestion(text);
    setOverlay("none");
    setLoading(true);
    const id = version.current,
      controller = new AbortController();
    request.current = controller;
    const input: LabRequest = {
      scenario,
      question: text.trim(),
      board: history.board,
    };
    const timeout = setTimeout(() => controller.abort(), 22000);
    let result: AnalysisResult;
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Unavailable");
      const json = await response.json();
      result = {
        analysis:
          json.analysis === null
            ? null
            : validateSequence(json.analysis, input.board),
        source: json.source === "openai" ? "openai" : "fallback",
        notice:
          typeof json.notice === "string" ? json.notice.slice(0, 300) : null,
      };
      if (!result.analysis && !result.notice) throw new Error("Empty response");
    } catch {
      result = curatedAnalysis(input);
    } finally {
      clearTimeout(timeout);
    }
    if (id !== version.current) return;
    setLoading(false);
    setNotice(result.notice);
    if (result.analysis) {
      setSession({
        analysis: result.analysis,
        source: result.source,
        base: input.board,
      });
      setAnnouncement(
        `${result.analysis.headline}. Sequence ready to preview.`,
      );
    }
  }
  function showPhase(next: Phase) {
    timeline.stop();
    setPhase(next);
    if (session && next !== "original")
      timeline.seek(
        totalDuration(
          next === "response"
            ? session.analysis.opponent.movements
            : session.analysis.actions,
        ),
      );
  }
  function step(direction: number) {
    if (!session) return;
    timeline.setPlaying(false);
    const list = phase === "original" ? session.analysis.actions : actions;
    if (phase === "original") setPhase("adjusted");
    const boundaries = [0];
    for (const a of list) boundaries.push(boundaries.at(-1)! + a.durationMs);
    const current = phase === "original" ? 0 : timeline.time;
    timeline.seek(
      direction > 0
        ? (boundaries.find((t) => t > current + 1) ?? boundaries.at(-1)!)
        : ([...boundaries].reverse().find((t) => t < current - 1) ?? 0),
    );
  }
  function play() {
    if (reduced) {
      step(1);
      return;
    }
    if (timeline.playing) {
      timeline.setPlaying(false);
      return;
    }
    if (phase === "original") {
      setPhase("adjusted");
      timeline.seek(0);
    } else if (timeline.time >= duration) timeline.seek(0);
    timeline.setPlaying(true);
  }
  function replay() {
    if (phase === "original") setPhase("adjusted");
    timeline.seek(0);
    timeline.setPlaying(!reduced);
  }
  function applyFinal() {
    if (!session) return;
    timeline.setPlaying(false);
    if (phase === "response") {
      if (applied < 1)
        dispatch({
          type: "commit",
          board: adjusted,
          label: "Tottenham adjustment",
        });
      if (applied < 2)
        dispatch({
          type: "commit",
          board: applyActions(adjusted, session.analysis.opponent.movements),
          label: "Arsenal response",
        });
      setApplied(2);
      timeline.seek(totalDuration(session.analysis.opponent.movements));
      setAnnouncement(
        "Possible Arsenal response applied. Undo restores Tottenham’s adjustment.",
      );
    } else {
      if (applied < 1)
        dispatch({
          type: "commit",
          board: adjusted,
          label: "Tottenham adjustment",
        });
      setApplied(Math.max(applied, 1));
      setPhase("adjusted");
      timeline.seek(totalDuration(session.analysis.actions));
      setAnnouncement(`Adjustment applied. ${session.analysis.afterLabel}.`);
    }
  }
  function respond() {
    if (!session) return;
    timeline.stop();
    setPhase("response");
    setExplored(true);
    timeline.setPlaying(!reduced);
    setAnnouncement("Exploring one possible Arsenal response.");
  }
  function closeHelp() {
    dialog.current?.close();
    help.current?.focus();
  }
  const overlayHint =
    overlay === "passing"
      ? "Nearest four teammates · green: lane appears open · amber: opponent near lane"
      : overlay === "shape"
        ? "Outfield team shapes · illustrative geometry"
        : overlay === "pressure"
          ? "Opponents within 14 pitch-length units of the selected player or ball carrier"
          : null;
  return (
    <MotionConfig reducedMotion="user">
      <div className="lab-app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            THIRDMAN<span className="brand-dot">.</span>
            <span className="product-label">AI football tactics sandbox</span>
          </div>
          <div className="nav-actions">
            <label className="scenario-select">
              <span className="sr-only">Scenario</span>
              <select
                aria-label="Scenario"
                value={scenario}
                onChange={(e) => reset(e.target.value as ScenarioId)}
              >
                {scenarioIds.map((id) => (
                  <option key={id} value={id}>
                    {scenarios[id].name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
            <button
              className="icon-button"
              ref={help}
              onClick={() => dialog.current?.showModal()}
              aria-label="How it works"
              title="How it works"
            >
              <HelpCircle size={19} />
            </button>
            <button
              className="quiet-button reset-button"
              onClick={() => reset()}
              aria-label="Reset"
              title="Restore this scenario"
            >
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
          </div>
        </header>
        <main className="lab-main">
          <div className="board-tools">
            <div className="team-switch" role="group" aria-label="Team to edit">
              {(["tottenham", "arsenal"] as const).map((t) => (
                <button
                  key={t}
                  disabled={!!session}
                  aria-pressed={team === t}
                  onClick={() => {
                    setTeam(t);
                    setSelected(null);
                  }}
                >
                  <span className={`team-dot ${t}`} />
                  {teamName(t)}
                </button>
              ))}
            </div>
            <label className="formation-select">
              <span className="sr-only">Formation for {teamName(team)}</span>
              <select
                aria-label="Formation"
                value={history.board.formations[team]}
                disabled={!!session}
                onChange={(e) => {
                  setSelected(null);
                  commit(
                    changeFormation(
                      history.board,
                      team,
                      e.target.value as Formation,
                    ),
                    `${teamName(team)} formation`,
                  );
                }}
              >
                {!formationNames.includes(
                  history.board.formations[team] as Formation,
                ) && <option>{history.board.formations[team]}</option>}
                {formationNames.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
              <ChevronDown size={12} />
            </label>
            {history.board.custom[team] && (
              <span className="custom-label">Edited shape</span>
            )}
            <div className="tools-right">
              <label className="overlay-select">
                <span className="sr-only">Tactical overlay</span>
                <select
                  aria-label="Tactical overlay"
                  value={overlay}
                  onChange={(e) => setOverlay(e.target.value as Overlay)}
                >
                  <option value="none">Overlays off</option>
                  <option value="passing">Passing options</option>
                  <option value="shape">Team shape</option>
                  <option value="pressure">Nearby pressure</option>
                </select>
                <ChevronDown size={13} />
              </label>
              <div className="history-tools">
                <button
                  className="icon-button"
                  disabled={!history.past.length}
                  aria-label="Undo"
                  title={
                    history.past.at(-1)?.label
                      ? `Undo ${history.past.at(-1)!.label}`
                      : "Undo"
                  }
                  onClick={undo}
                >
                  <Undo2 size={18} />
                </button>
                <button
                  className="icon-button"
                  disabled={!history.future.length}
                  aria-label="Redo"
                  title="Redo"
                  onClick={redo}
                >
                  <Redo2 size={18} />
                </button>
              </div>
            </div>
          </div>
          <div className={`stage ${hasInspector ? "with-inspector" : ""}`}>
            <section
              ref={workspace}
              className="board-area"
              aria-label="Tactical workspace"
            >
              {session && (
                <div
                  className="comparison"
                  role="group"
                  aria-label="Compare stages"
                >
                  <button
                    aria-pressed={phase === "original"}
                    onClick={() => showPhase("original")}
                  >
                    Original
                  </button>
                  <span>→</span>
                  <button
                    aria-pressed={phase === "adjusted"}
                    onClick={() => showPhase("adjusted")}
                  >
                    Tottenham adjustment
                  </button>
                  <span>→</span>
                  <button
                    aria-pressed={phase === "response"}
                    disabled={!explored}
                    onClick={() => showPhase("response")}
                  >
                    Arsenal response
                  </button>
                  <span className="preview-state">
                    {phase === "original"
                      ? "Original snapshot"
                      : (phase === "response" ? applied >= 2 : applied >= 1)
                        ? "Saved to board"
                        : "Preview only"}
                  </span>
                </div>
              )}
              <Pitch
                board={displayed}
                ball={session ? sample.ball : owner}
                editableTeam={team}
                locked={!!session}
                direct={!!session}
                selected={selected}
                overlay={overlay}
                ghosts={ghosts}
                activeIds={session ? sample.activeIds : []}
                response={
                  session && phase === "response"
                    ? session.analysis.opponent
                    : null
                }
                onSelect={setSelected}
                onBegin={() => {
                  clearPreview();
                  gesture.current = history.board;
                }}
                onMove={(id, p) => {
                  clearPreview();
                  dispatch({
                    type: "live",
                    board: movePlayer(history.board, id, p),
                  });
                }}
                onEnd={() => {
                  if (gesture.current) {
                    dispatch({ type: "gesture", before: gesture.current });
                    gesture.current = null;
                  }
                }}
                onKeyMove={keyMove}
              />
              {session ? (
                <div className="transport">
                  <div className="transport-row">
                    <button
                      className="play-button"
                      onClick={play}
                      aria-label={
                        reduced
                          ? "Next step"
                          : timeline.playing
                            ? "Pause sequence"
                            : completed
                              ? "Replay sequence"
                              : "Play sequence"
                      }
                    >
                      {reduced ? (
                        <SkipForward size={16} />
                      ) : timeline.playing ? (
                        <Pause size={16} fill="currentColor" />
                      ) : (
                        <Play size={16} fill="currentColor" />
                      )}
                      <span>
                        {reduced
                          ? "Next step"
                          : timeline.playing
                            ? "Pause"
                            : completed
                              ? "Replay"
                              : "Play sequence"}
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Previous step"
                      onClick={() => step(-1)}
                      disabled={timeline.time === 0}
                    >
                      <SkipBack size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Next step"
                      onClick={() => step(1)}
                      disabled={completed}
                    >
                      <SkipForward size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Restart sequence"
                      onClick={replay}
                    >
                      <RotateCcw size={16} />
                    </button>
                    <span className="step-count">
                      {phase === "original"
                        ? "Original"
                        : `${Math.min(sample.index + 1, actions.length)} / ${actions.length}`}
                    </span>
                    <span className="caption" aria-live="off">
                      {phase === "original"
                        ? session.analysis.beforeLabel
                        : completed
                          ? phase === "response"
                            ? session.analysis.opponent.space.label
                            : session.analysis.afterLabel
                          : sample.caption}
                    </span>
                  </div>
                  <input
                    className="timeline-slider"
                    type="range"
                    aria-label="Sequence progress"
                    min="0"
                    max={duration || 1}
                    step="20"
                    value={Math.min(timeline.time, duration || 1)}
                    onChange={(e) => {
                      timeline.setPlaying(false);
                      timeline.seek(Number(e.target.value));
                    }}
                    disabled={phase === "original"}
                  />
                  {overlayHint && (
                    <p className="overlay-note">
                      {overlayHint}. Geometry only; not a pass prediction.
                    </p>
                  )}
                </div>
              ) : (
                <div className="board-context">
                  <p>{overlayHint ?? scenarios[scenario].description}</p>
                  <span>
                    {overlayHint
                      ? "Illustrative geometry"
                      : `Editing ${teamName(team)} · select or drag a player`}
                  </span>
                </div>
              )}
            </section>
            {hasInspector && (
              <aside
                className="inspector"
                aria-label={session ? "Sequence inspector" : "Player inspector"}
              >
                <div className="inspector-top">
                  <span>
                    {session
                      ? phase === "response"
                        ? "Possible response"
                        : "Tactical exploration"
                      : "Selected player"}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={
                      session ? "Cancel preview" : "Close player inspector"
                    }
                    onClick={() => {
                      clearPreview();
                      setSelected(null);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
                {session ? (
                  <>
                    <div className="inspector-content">
                      <span className="source-label">
                        {session.source === "openai"
                          ? "Live AI analysis"
                          : "Curated exploration"}
                      </span>
                      <h1>
                        {phase === "response"
                          ? "Close one door. Open another."
                          : session.analysis.headline}
                      </h1>
                      <p className="diagnosis">
                        {phase === "response"
                          ? session.analysis.opponent.explanation
                          : session.analysis.diagnosis}
                      </p>
                      {notice && <p className="inline-notice">{notice}</p>}
                      <div
                        className="sequence-list"
                        aria-label="Sequence steps"
                      >
                        {(phase === "response"
                          ? session.analysis.opponent.movements
                          : session.analysis.actions
                        ).map((a, i) => (
                          <button
                            key={i}
                            className={`sequence-step ${sample.index === i && phase !== "original" ? "current" : ""}`}
                            onClick={() => {
                              if (phase === "original") setPhase("adjusted");
                              timeline.setPlaying(false);
                              timeline.seek(
                                (phase === "response"
                                  ? session.analysis.opponent.movements
                                  : session.analysis.actions
                                )
                                  .slice(0, i + 1)
                                  .reduce((n, x) => n + x.durationMs, 0),
                              );
                            }}
                          >
                            <span className="step-number">{i + 1}</span>
                            <span>
                              <small>
                                {a.type === "move"
                                  ? "MOVE"
                                  : a.type === "pass"
                                    ? "PASS"
                                    : "OBSERVE"}
                              </small>
                              {a.caption}
                            </span>
                          </button>
                        ))}
                      </div>
                      {phase === "response" && (
                        <div className="space-note">
                          <span className="space-dot" />
                          {session.analysis.opponent.space.label}
                          <small>
                            Dashed route: a possible next connection
                          </small>
                        </div>
                      )}
                      <details className="tactical-detail">
                        <summary>
                          Objective & tradeoff <ChevronDown size={14} />
                        </summary>
                        <h3>Objective</h3>
                        <p>{session.analysis.objective}</p>
                        <h3>Tradeoff</h3>
                        <p>{session.analysis.tradeoff}</p>
                      </details>
                    </div>
                    <div className="inspector-actions">
                      <button
                        className="primary-button"
                        onClick={applyFinal}
                        disabled={
                          phase === "response" ? applied >= 2 : applied >= 1
                        }
                      >
                        {(
                          phase === "response" ? applied >= 2 : applied >= 1
                        ) ? (
                          <>
                            <Check size={16} />
                            Shape applied
                          </>
                        ) : (
                          <>
                            {phase === "response"
                              ? "Apply response"
                              : "Apply final shape"}
                            <ArrowRight size={17} />
                          </>
                        )}
                      </button>
                      {phase !== "response" && (completed || applied >= 1) && (
                        <button className="response-button" onClick={respond}>
                          Explore Arsenal’s response <ArrowRight size={15} />
                        </button>
                      )}
                      <button
                        className="cancel-link"
                        onClick={() => {
                          clearPreview();
                          setSelected(null);
                        }}
                      >
                        {applied ? "Return to editing" : "Cancel preview"}
                      </button>
                    </div>
                  </>
                ) : (
                  selection && (
                    <div className="player-inspector">
                      <span className={`team-dot ${selection.team}`} />
                      <h1>{selection.role}</h1>
                      <p>
                        {teamName(selection.team)} ·{" "}
                        {history.board.custom[selection.team]
                          ? "Edited shape"
                          : history.board.formations[selection.team]}
                      </p>
                      <button
                        className="primary-button"
                        disabled={history.board.possession === selection.id}
                        onClick={() =>
                          commit(
                            { ...history.board, possession: selection.id },
                            "Change possession",
                          )
                        }
                      >
                        {history.board.possession === selection.id ? (
                          <>
                            <Check size={16} />
                            In possession
                          </>
                        ) : (
                          <>
                            Give possession
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                      <p className="selection-help">
                        Drag to move. Use arrow keys for small adjustments, or
                        Shift + arrows for larger steps.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => setOverlay("pressure")}
                      >
                        Show nearby pressure <ArrowRight size={14} />
                      </button>
                    </div>
                  )
                )}
              </aside>
            )}
          </div>
          <section className="question-dock" aria-label="Ask Thirdman">
            {notice && !session && (
              <p className="inline-notice" role="status">
                {notice}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void analyze();
              }}
            >
              <label htmlFor="question" className="sr-only">
                Tactical question
              </label>
              <input
                id="question"
                value={question}
                maxLength={500}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you change about this shape?"
                autoComplete="off"
              />
              <button
                className="primary-button explore-button"
                disabled={loading || !question.trim()}
              >
                {loading ? (
                  <>
                    <LoaderCircle size={17} className="spin" />
                    Reading the shape…
                  </>
                ) : (
                  <>
                    Explore
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
            <div className="exploration-shortcuts">
              {explorations.map((e) => (
                <button
                  key={e.label}
                  onClick={() => void analyze(e.question)}
                  disabled={loading}
                >
                  {e.label}
                </button>
              ))}
              <span>
                <CornerDownLeft size={12} /> Enter to explore
              </span>
            </div>
          </section>
        </main>
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
        <dialog
          ref={dialog}
          className="how-dialog"
          aria-labelledby="how-title"
          onCancel={closeHelp}
          onClick={(e) => {
            if (e.target === dialog.current) closeHelp();
          }}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              dialog.current
                ?.querySelector<HTMLButtonElement>(".dialog-close")
                ?.focus();
            }
          }}
        >
          <div>
            <button
              autoFocus
              className="icon-button dialog-close"
              onClick={closeHelp}
              aria-label="Close how it works"
            >
              <X size={20} />
            </button>
            <h2 id="how-title">Your next move changes the game.</h2>
            <ol>
              <li>
                <strong>Set up.</strong> Pick a scenario. Edit either team,
                change the formation, or give a selected player the ball.
              </li>
              <li>
                <strong>Explore.</strong> Ask a tactical question. Preview the
                movements before changing your board.
              </li>
              <li>
                <strong>Play.</strong> Watch the ball and players connect.
                Pause, replay, or step through the sequence.
              </li>
              <li>
                <strong>Respond.</strong> Explore a possible Arsenal response
                and the space it leaves.
              </li>
              <li>
                <strong>Compare.</strong> Switch between stages. Apply a shape
                when you’re ready; undo always takes you back.
              </li>
            </ol>
            <p>
              Sequences illustrate tactical ideas. They are not match
              simulations or predictions. Reduced motion uses the step controls.
            </p>
          </div>
        </dialog>
      </div>
    </MotionConfig>
  );
}
