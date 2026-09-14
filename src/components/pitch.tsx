"use client";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  convexHull,
  distance,
  passingOptions,
  passLane,
  type Board,
  type Action,
  type Team,
  type MoveAction,
  type Sequence,
} from "@/lib/lab";
import { clamp, type Position } from "@/lib/tactics";
export type Overlay = "none" | "passing" | "shape" | "pressure";
type Props = {
  board: Board;
  ball: Position;
  editableTeam: Team;
  locked: boolean;
  direct: boolean;
  selected: string | null;
  overlay: Overlay;
  ghosts: MoveAction[];
  activeIds: string[];
  pressingIds: string[];
  activePass: Extract<Action, { type: "pass" }> | null;
  previewLabel: string;
  response: Sequence["opponent"] | null;
  onSelect: (id: string) => void;
  onBegin: () => void;
  onMove: (id: string, p: Position) => void;
  onEnd: () => void;
  onKeyMove: (id: string, p: Position) => void;
};
export default function Pitch({
  board,
  ball,
  editableTeam,
  locked,
  direct,
  selected,
  overlay,
  ghosts,
  activeIds,
  pressingIds,
  activePass,
  previewLabel,
  response,
  onSelect,
  onBegin,
  onMove,
  onEnd,
  onKeyMove,
}: Props) {
  const surface = useRef<HTMLDivElement>(null),
    drag = useRef<{
      id: string;
      pointerId: number;
      dx: number;
      dy: number;
      startX: number;
      startY: number;
      moved: boolean;
    } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const focus = board.players.find(
    (p) => p.id === (selected || board.possession),
  )!;
  const owner = board.players.find((p) => p.id === board.possession)!;
  const options =
    overlay === "passing" && !activePass ? passingOptions(board) : [];
  function finish() {
    if (drag.current) {
      onEnd();
      drag.current = null;
      setDragging(null);
    }
  }
  return (
    <div
      className={`pitch ${locked ? "preview-pitch" : ""}`}
      ref={surface}
      aria-label="Football tactics board. Tottenham attacks left to right."
    >
      <div className="pitch-center-circle" aria-hidden="true" />
      <svg
        className="pitch-lines"
        viewBox="0 0 1000 620"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="grass"
            width="125"
            height="620"
            patternUnits="userSpaceOnUse"
          >
            <rect width="62.5" height="620" fill="white" opacity=".017" />
          </pattern>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path
              d="M0 0L10 5L0 10"
              fill="none"
              stroke="#c3ee85"
              strokeWidth="1.5"
            />
          </marker>
        </defs>
        <rect width="1000" height="620" fill="url(#grass)" />
        <g stroke="currentColor" strokeWidth="1.3">
          <rect x="22" y="22" width="956" height="576" />
          <path d="M500 22V598 M22 160H166V460H22 M978 160H834V460H978 M22 242H74V378H22 M978 242H926V378H978 M166 243Q227 310 166 377 M834 243Q773 310 834 377 M22 276H8V344H22 M978 276H992V344H978" />
          <path d="M22 35Q35 35 35 22 M965 22Q965 35 978 35 M22 585Q35 585 35 598 M965 598Q965 585 978 585" />
        </g>
        <g fill="currentColor">
          <circle cx="500" cy="310" r="2.5" />
          <circle cx="125" cy="310" r="2.5" />
          <circle cx="875" cy="310" r="2.5" />
        </g>
        {overlay === "shape" &&
          (["tottenham", "arsenal"] as const).map((team) => (
            <polygon
              key={team}
              points={convexHull(
                board.players.filter((p) => p.team === team && p.role !== "GK"),
              )
                .map((p) => `${p.x * 10},${p.y * 6.2}`)
                .join(" ")}
              fill={team === "tottenham" ? "#d5e7c5" : "#e3917e"}
              fillOpacity=".06"
              stroke={team === "tottenham" ? "#d5e7c5" : "#e3917e"}
              strokeOpacity=".35"
              strokeWidth="1.5"
            />
          ))}
        {overlay === "passing" &&
          activePass &&
          (() => {
            const receiver = board.players.find(
              (p) => p.id === activePass.toId,
            )!;
            return (
              <path
                data-pass-in-flight={activePass.toId}
                d={`M${ball.x * 10} ${ball.y * 6.2}L${receiver.x * 10} ${receiver.y * 6.2}`}
                stroke="#c3ee85"
                strokeWidth="2.5"
                strokeDasharray="5 7"
                markerEnd="url(#arrow)"
              />
            );
          })()}
        {options.map(({ player, blocked }) => (
          <path
            key={player.id}
            data-passing-to={player.id}
            data-blocked={blocked}
            d={`M${owner.x * 10} ${owner.y * 6.2}L${player.x * 10} ${player.y * 6.2}`}
            stroke={blocked ? "#e6a478" : "#c3ee85"}
            strokeWidth="2.5"
            strokeOpacity=".65"
            strokeDasharray={blocked ? "5 6" : undefined}
          />
        ))}
        {overlay === "pressure" && (
          <g>
            <ellipse
              cx={focus.x * 10}
              cy={focus.y * 6.2}
              rx="140"
              ry="140"
              fill="#eaa57c"
              fillOpacity=".035"
              stroke="#eaa57c"
              strokeOpacity=".25"
              strokeDasharray="4 6"
            />
            {board.players
              .filter((p) => p.team !== focus.team && distance(p, focus) < 14)
              .map((p) => (
                <g key={p.id}>
                  <circle
                    cx={p.x * 10}
                    cy={p.y * 6.2}
                    r="30"
                    stroke="#eaa57c"
                    strokeWidth="2"
                  />
                  <path
                    d={`M${p.x * 10} ${p.y * 6.2}L${focus.x * 10} ${focus.y * 6.2}`}
                    stroke="#eaa57c"
                    strokeOpacity=".5"
                    strokeDasharray="4 6"
                  />
                </g>
              ))}
          </g>
        )}
        {ghosts.map((a, i) => {
          const p = board.players.find((p) => p.id === a.playerId)!;
          return (
            <g key={`${a.playerId}-${i}`}>
              <path
                d={`M${p.x * 10} ${p.y * 6.2}L${a.targetX * 10} ${a.targetY * 6.2}`}
                stroke="#c3ee85"
                strokeWidth="2.5"
                strokeDasharray="5 7"
                markerEnd="url(#arrow)"
              />
              <circle
                cx={a.targetX * 10}
                cy={a.targetY * 6.2}
                r="23"
                stroke="#c3ee85"
                strokeDasharray="3 4"
                fill="#c3ee85"
                fillOpacity=".06"
              />
            </g>
          );
        })}
        {response && (
          <g>
            <ellipse
              cx={response.space.x * 10}
              cy={response.space.y * 6.2}
              rx="90"
              ry="75"
              fill="#c3ee85"
              fillOpacity=".12"
              stroke="#c3ee85"
              strokeOpacity=".55"
              strokeDasharray="4 5"
            />
            {(() => {
              if (
                passLane(board, board.possession, response.outletPlayerId)
                  .blocked
              )
                return null;
              const to = board.players.find(
                (p) => p.id === response.outletPlayerId,
              )!;
              return (
                <path
                  data-response-route="open"
                  d={`M${ball.x * 10} ${ball.y * 6.2}L${to.x * 10} ${to.y * 6.2}`}
                  stroke="#c3ee85"
                  strokeWidth="2.5"
                  strokeDasharray="5 7"
                  markerEnd="url(#arrow)"
                />
              );
            })()}
          </g>
        )}
      </svg>
      {board.players.map((p) => (
        <motion.button
          key={`${p.id}-${direct ? "preview" : "edit"}`}
          type="button"
          className={`player ${p.team} ${selected === p.id ? "selected" : ""} ${activeIds.includes(p.id) ? "active-player" : ""} ${dragging === p.id ? "dragging" : ""} ${pressingIds.includes(p.id) ? "pressing-player" : ""}`}
          data-player-id={p.id}
          data-pressing={pressingIds.includes(p.id)}
          data-x={p.x.toFixed(2)}
          data-y={p.y.toFixed(2)}
          aria-label={`${p.team === "tottenham" ? "Tottenham" : "Arsenal"} ${p.role}`}
          aria-pressed={selected === p.id}
          aria-disabled={locked || p.team !== editableTeam}
          tabIndex={!locked && p.team === editableTeam ? 0 : -1}
          initial={false}
          animate={{ left: `${p.x}%`, top: `${p.y}%` }}
          transition={{
            duration: direct || dragging === p.id || reduced ? 0 : 0.55,
            ease: [0.22, 1, 0.36, 1],
          }}
          onClick={() => {
            if (!locked && p.team === editableTeam) onSelect(p.id);
          }}
          onPointerDown={(e) => {
            if (
              locked ||
              p.team !== editableTeam ||
              e.button !== 0 ||
              !surface.current
            )
              return;
            const r = surface.current.getBoundingClientRect();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              id: p.id,
              pointerId: e.pointerId,
              dx: ((e.clientX - r.left) / r.width) * 100 - p.x,
              dy: ((e.clientY - r.top) / r.height) * 100 - p.y,
              startX: e.clientX,
              startY: e.clientY,
              moved: false,
            };
            onBegin();
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (
              !d ||
              d.id !== p.id ||
              d.pointerId !== e.pointerId ||
              !surface.current
            )
              return;
            if (
              !d.moved &&
              Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 3
            )
              return;
            d.moved = true;
            setDragging(p.id);
            const r = surface.current.getBoundingClientRect();
            onMove(p.id, {
              x: clamp(((e.clientX - r.left) / r.width) * 100 - d.dx),
              y: clamp(((e.clientY - r.top) / r.height) * 100 - d.dy),
            });
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
          onKeyDown={(e) => {
            if (
              locked ||
              p.team !== editableTeam ||
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                e.key,
              )
            )
              return;
            e.preventDefault();
            const n = e.shiftKey ? 5 : 1;
            onKeyMove(p.id, {
              x: clamp(
                p.x +
                  (e.key === "ArrowRight" ? n : e.key === "ArrowLeft" ? -n : 0),
              ),
              y: clamp(
                p.y +
                  (e.key === "ArrowDown" ? n : e.key === "ArrowUp" ? -n : 0),
              ),
            });
          }}
        >
          {p.role}
        </motion.button>
      ))}
      <motion.div
        key={direct ? "preview-ball" : "edit-ball"}
        className="ball"
        aria-label={
          activePass
            ? `Ball travelling to ${board.players.find((p) => p.id === activePass.toId)!.role}`
            : `Ball with ${owner.team === "tottenham" ? "Tottenham" : "Arsenal"} ${owner.role}`
        }
        data-possession={board.possession}
        data-x={ball.x.toFixed(2)}
        data-y={ball.y.toFixed(2)}
        initial={false}
        animate={{ left: `${ball.x}%`, top: `${ball.y}%` }}
        transition={{ duration: direct || dragging || reduced ? 0 : 0.55 }}
      >
        <span />
      </motion.div>
      <span className="attack-label" aria-hidden="true">
        TOTTENHAM →
      </span>
      {locked && (
        <span className="preview-badge">
          {previewLabel}
          {pressingIds.length > 0 ? " · pressure closing" : ""}
        </span>
      )}
    </div>
  );
}
