"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  CornerDownLeft,
  Crosshair,
  GitBranch,
  Layers3,
  LoaderCircle,
  RotateCcw,
  Shield,
  Target,
  X,
} from "lucide-react";
import Pitch from "./pitch";
import {
  initialPlayers,
  scenarios,
  scenarioIds,
  validateAnalysis,
  type Analysis,
  type Player,
  type Position,
  type ScenarioId,
} from "@/lib/tactics";
import { fallbackAnalysis } from "@/lib/fallback";

const examples = [
  "How do we beat this press?",
  "Where is the overload?",
  "What happens if my fullback inverts?",
  "How can we create a free man?",
];
const scenarioIcons = [GitBranch, Layers3, Shield];

export default function Sandbox() {
  const [scenario, setScenario] = useState<ScenarioId>("press");
  const [players, setPlayers] = useState<Player[]>(() =>
    initialPlayers("press"),
  );
  const [question, setQuestion] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [origin, setOrigin] = useState<Position | null>(null);
  const [counter, setCounter] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [source, setSource] = useState<"openai" | "fallback" | null>(null);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const current = scenarios[scenario];
  useEffect(() => () => request.current?.abort(), []);

  function clearAnalysis() {
    sequence.current += 1;
    request.current?.abort();
    setAnalysis(null);
    setSource(null);
    setApplied(false);
    setOrigin(null);
    setCounter(false);
    setLoading(false);
    setAnnouncement("");
  }
  function selectScenario(id: ScenarioId) {
    clearAnalysis();
    setScenario(id);
    setPlayers(initialPlayers(id));
    setQuestion("");
  }
  function movePlayer(id: string, position: Position) {
    clearAnalysis();
    setPlayers((previous) =>
      previous.map((player) =>
        player.id === id ? { ...player, ...position } : player,
      ),
    );
  }
  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim() || loading) return;
    clearAnalysis();
    const version = sequence.current;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    const timeout = setTimeout(() => controller.abort(), 22_000);
    const snapshot = players;
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          scenario,
          question: question.trim(),
          userFormation: current.userFormation,
          opponentFormation: current.opponentFormation,
          players: snapshot,
        }),
      });
      if (!response.ok) throw new Error("Analysis unavailable");
      const result = await response.json();
      const validated = validateAnalysis(result.analysis, snapshot);
      if (version !== sequence.current) return;
      setAnalysis(validated);
      setSource(result.source === "openai" ? "openai" : "fallback");
      setAnnouncement(
        `${validated.headline}. ${validated.recommendation.instruction}`,
      );
    } catch {
      if (version !== sequence.current) return;
      const fallback = fallbackAnalysis(scenario, snapshot);
      setAnalysis(fallback);
      setSource("fallback");
      setAnnouncement(
        `${fallback.headline}. ${fallback.recommendation.instruction}`,
      );
    } finally {
      clearTimeout(timeout);
      if (version === sequence.current) setLoading(false);
    }
  }
  function apply() {
    if (!analysis || applied) return;
    const validated = validateAnalysis(analysis, players);
    const player = players.find(
      (p) => p.id === validated.recommendation.playerId,
    )!;
    setOrigin({ x: player.x, y: player.y });
    setPlayers((previous) =>
      previous.map((p) =>
        p.id === player.id
          ? {
              ...p,
              x: validated.recommendation.targetX,
              y: validated.recommendation.targetY,
            }
          : p,
      ),
    );
    setApplied(true);
    setAnnouncement(`Adjustment applied. ${validated.afterLabel}.`);
  }
  function closeHelp() {
    dialog.current?.close();
    helpButton.current?.focus();
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <header className="topbar">
          <Link className="brand" href="/" aria-label="Thirdman home">
            <span className="brand-symbol">
              <i />
              <i />
              <i />
            </span>
            THIRDMAN<span className="brand-period">.</span>
          </Link>
          <span className="nav-subtitle">AI FOOTBALL TACTICS SANDBOX</span>
          <nav aria-label="Main navigation">
            <button
              ref={helpButton}
              onClick={() => dialog.current?.showModal()}
            >
              <CircleHelp size={14} /> HOW IT WORKS
            </button>
            <span className="nav-separator" />
            <button onClick={() => selectScenario("press")}>
              <RotateCcw size={14} /> RESET
            </button>
          </nav>
        </header>
        <main>
          <section className="intro">
            <div>
              <div className="eyebrow">
                <span className="live-dot" /> YOUR NEXT MOVE CHANGES THE GAME
              </div>
              <h1>
                See the game <span>differently.</span>
              </h1>
              <p>
                Move players, change the shape, and ask AI how the game changes.
              </p>
            </div>
            <div className="intro-note">
              <span>THE TACTICS LAB</span>
              <span>
                01 <span className="note-line" /> EXPLORE. UNDERSTAND. ADAPT.
              </span>
            </div>
          </section>
          <div className="workspace">
            <section className="board-section" aria-label="Tactical workspace">
              <div
                className="scenario-tabs"
                role="group"
                aria-label="Tactical scenarios"
              >
                {scenarioIds.map((id, i) => {
                  const Icon = scenarioIcons[i];
                  return (
                    <button
                      key={id}
                      aria-pressed={scenario === id}
                      onClick={() => selectScenario(id)}
                    >
                      <Icon size={15} />
                      <span>{scenarios[id].name}</span>
                      <small>0{i + 1}</small>
                    </button>
                  );
                })}
              </div>
              <div className="board-card">
                <div className="match-header">
                  <div className="match-teams">
                    <div>
                      <span className="team-dot home" />
                      <strong>Tottenham</strong>
                      <span className="formation">{current.userFormation}</span>
                    </div>
                    <span className="versus">vs</span>
                    <div>
                      <span className="team-dot away" />
                      <strong>Arsenal</strong>
                      <span className="formation">
                        {current.opponentFormation}
                      </span>
                    </div>
                  </div>
                  <span className="board-tag">SANDBOX</span>
                </div>
                <Pitch
                  players={players}
                  analysis={analysis}
                  applied={applied}
                  origin={origin}
                  onMove={movePlayer}
                />
                <div className={`board-status ${applied ? "is-applied" : ""}`}>
                  {applied && analysis ? (
                    <>
                      <div>
                        <span className="small-label">BEFORE</span>
                        <strong>{analysis.beforeLabel}</strong>
                      </div>
                      <ArrowRight size={20} />
                      <div className="after">
                        <span className="small-label">AFTER</span>
                        <strong>{analysis.afterLabel}</strong>
                      </div>
                      <span className="status-check">
                        <Check size={15} /> ADJUSTMENT APPLIED
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="phase-icon">
                        <Crosshair size={20} />
                      </div>
                      <div>
                        <span className="small-label">{current.phase}</span>
                        <p>{current.description}</p>
                      </div>
                      <span className="status-number">
                        {scenario === "press"
                          ? "2v2"
                          : scenario === "block"
                            ? "4–5–1"
                            : "4–3–3"}
                        <small>
                          {scenario === "press"
                            ? "FIRST LINE"
                            : "STARTING SHAPE"}
                        </small>
                      </span>
                    </>
                  )}
                </div>
              </div>
              <form className="question-box" onSubmit={analyze}>
                <label htmlFor="tactical-question">
                  <span className="small-label">ASK THIRDMAN</span>
                  <span>Find your next move.</span>
                </label>
                <div className="question-row">
                  <input
                    ref={input}
                    id="tactical-question"
                    value={question}
                    maxLength={500}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={
                      scenario === "press"
                        ? "How should we play through this press?"
                        : current.question
                    }
                    autoComplete="off"
                  />
                  <button
                    className="primary-button"
                    disabled={!question.trim() || loading}
                    type="submit"
                  >
                    {loading ? (
                      <>
                        <LoaderCircle size={15} className="spin" /> READING THE
                        SHAPE...
                      </>
                    ) : (
                      <>
                        ANALYZE SHAPE <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
                <div className="example-questions">
                  <span>TRY</span>
                  {(scenario === "press"
                    ? examples
                    : [current.question, ...examples.slice(1)]
                  ).map((example, i) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setQuestion(example);
                        input.current?.focus();
                      }}
                      className={i > 1 ? "extra-example" : ""}
                    >
                      {example}
                      <ArrowUpRight size={11} />
                    </button>
                  ))}
                  <CornerDownLeft size={12} className="enter-hint" />
                </div>
              </form>
            </section>
            <aside
              className="analysis-panel"
              aria-label="Tactical analysis"
              aria-busy={loading}
            >
              <div className="panel-header">
                <div>
                  <span className="analysis-icon">
                    <GitBranch size={15} />
                  </span>
                  <h2>TACTICAL ANALYSIS</h2>
                </div>
                <span className="panel-state">
                  <span className={`live-dot ${loading ? "pulsing" : ""}`} />
                  {loading ? "READING" : analysis ? "READY" : "STANDING BY"}
                </span>
              </div>
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="loading"
                    className="empty-analysis loading-analysis"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <TacticalMotif loading />
                    <span className="eyebrow">READING THE SHAPE...</span>
                    <h3>Finding the next move.</h3>
                    <p>
                      Looking at the passing lanes, the pressure, and the space
                      in between.
                    </p>
                    <div className="scan-line" />
                  </motion.div>
                ) : analysis ? (
                  <motion.div
                    key="result"
                    className="analysis-result"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="observation">
                      <span className="small-label">
                        OBSERVATION <span>01</span>
                      </span>
                      <h3>{analysis.headline}</h3>
                      <p className="principle">{analysis.principle}</p>
                    </div>
                    <div className="analysis-section">
                      <h4>THE PROBLEM</h4>
                      <p>{analysis.diagnosis}</p>
                    </div>
                    <div className="adjustment-section">
                      <span className="adjustment-number">↳</span>
                      <div>
                        <h4>THE ADJUSTMENT</h4>
                        <p>{analysis.recommendation.instruction}</p>
                      </div>
                    </div>
                    <div className="analysis-section reasons">
                      <h4>WHY IT WORKS</h4>
                      <ul>
                        {analysis.whyItWorks.map((reason) => (
                          <li key={reason}>
                            <Check size={13} />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="analysis-section tradeoff">
                      <h4>TRADEOFF</h4>
                      <p>{analysis.risk}</p>
                    </div>
                    <button
                      className={`apply-button ${applied ? "applied" : ""}`}
                      disabled={applied}
                      onClick={apply}
                    >
                      {applied ? (
                        <>
                          ADJUSTMENT APPLIED <Check size={16} />
                        </>
                      ) : (
                        <>
                          APPLY ADJUSTMENT <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                    {applied && (
                      <div className="opposition">
                        {counter ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            <h4>
                              <span className="team-dot away" /> OPPOSITION
                              RESPONSE
                            </h4>
                            <p>{analysis.opponentCounter}</p>
                          </motion.div>
                        ) : (
                          <button onClick={() => setCounter(true)}>
                            ASK OPPOSITION AI <ArrowUpRight size={15} />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="analysis-source">
                      {source === "openai"
                        ? "AI analysis · based on this board"
                        : "Scenario guide · based on this shape"}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    className="empty-analysis"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <TacticalMotif />
                    <span className="eyebrow">EVERY SHAPE HAS AN ANSWER</span>
                    <h3>
                      A different perspective.
                      <br />A better next move.
                    </h3>
                    <p>Ask a question about the current shape.</p>
                    <p className="empty-detail">
                      Uncover the overload. Find the free player.
                      <br />
                      See the adjustment on the pitch.
                    </p>
                    <button
                      className="start-prompt"
                      onClick={() => {
                        setQuestion(current.question);
                        input.current?.focus();
                      }}
                    >
                      Start with a question <ArrowRight size={15} />
                    </button>
                    <div className="analysis-steps">
                      <span>
                        <b>01</b> OBSERVE
                      </span>
                      <ChevronRight size={12} />
                      <span>
                        <b>02</b> ADJUST
                      </span>
                      <ChevronRight size={12} />
                      <span>
                        <b>03</b> ADAPT
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="panel-footer">
                <Target size={13} />
                <span>One shape. One adjustment. A new possibility.</span>
              </div>
            </aside>
          </div>
          <footer className="app-footer">
            <span>FOOTBALL IS A GAME OF POSSIBILITIES.</span>
            <span>
              BUILT TO EXPLORE THEM. <span className="footer-symbol">↗</span>
            </span>
          </footer>
        </main>
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
        <dialog
          ref={dialog}
          className="how-dialog"
          aria-labelledby="how-title"
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();
              dialog.current
                ?.querySelector<HTMLButtonElement>(".dialog-close")
                ?.focus();
            }
          }}
          onClick={(e) => {
            if (e.target === dialog.current) closeHelp();
          }}
          onCancel={closeHelp}
        >
          <div className="dialog-content">
            <button
              className="dialog-close"
              onClick={closeHelp}
              aria-label="Close how it works"
              autoFocus
            >
              <X size={20} />
            </button>
            <span className="eyebrow">THE TACTICS LAB</span>
            <h2 id="how-title">
              Football, from a<br />
              different angle.
            </h2>
            <div className="how-step">
              <b>01</b>
              <div>
                <h3>SHAPE</h3>
                <p>
                  Move players or choose a tactical scenario. You control
                  Tottenham; arrow keys also move a focused player.
                </p>
              </div>
            </div>
            <div className="how-step">
              <b>02</b>
              <div>
                <h3>ASK</h3>
                <p>Ask Thirdman how the current structure can improve.</p>
              </div>
            </div>
            <div className="how-step">
              <b>03</b>
              <div>
                <h3>ADAPT</h3>
                <p>
                  Apply the recommendation and see its tactical effect. Then
                  explore how the opposition could respond.
                </p>
              </div>
            </div>
            <p className="dialog-foot">
              Built as an exploration of generative AI + football tactics.
            </p>
          </div>
        </dialog>
      </div>
    </MotionConfig>
  );
}
function TacticalMotif({ loading = false }: { loading?: boolean }) {
  return (
    <div
      className={`tactical-motif ${loading ? "is-scanning" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 200 140" fill="none">
        <path
          d="M35 100L100 35L165 100H35Z"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 5"
        />
        <path d="M100 35V100" stroke="currentColor" strokeOpacity=".3" />
        <circle cx="35" cy="100" r="12" fill="#202b22" stroke="currentColor" />
        <circle cx="165" cy="100" r="12" fill="#202b22" stroke="currentColor" />
        <circle
          cx="100"
          cy="35"
          r="17"
          fill="#c2f778"
          fillOpacity=".09"
          stroke="#c2f778"
          strokeOpacity=".7"
        />
        <circle cx="100" cy="35" r="4" fill="#c2f778" />
        <circle
          cx="100"
          cy="100"
          r="10"
          stroke="currentColor"
          strokeOpacity=".5"
          strokeDasharray="2 3"
        />
        <path d="M87 76L100 87L113 76" stroke="#c2f778" strokeOpacity=".5" />
      </svg>
    </div>
  );
}
