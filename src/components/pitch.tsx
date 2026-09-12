"use client";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Move } from "lucide-react";
import {
  clamp,
  type Player,
  type Position,
  type Analysis,
} from "@/lib/tactics";

type Props = {
  players: Player[];
  analysis: Analysis | null;
  applied: boolean;
  origin: Position | null;
  onMove: (id: string, position: Position) => void;
};
export default function Pitch({
  players,
  analysis,
  applied,
  origin,
  onMove,
}: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    pointerId: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const mover = players.find((p) => p.id === analysis?.recommendation.playerId);
  const start = applied ? origin : mover;
  const target = analysis?.recommendation;
  return (
    <>
      <div className="pitch-meta">
        <span>
          <span className="live-dot" /> TACTICAL BOARD{" "}
          <span className="meta-divider">/</span> 01
        </span>
        <span className="attack-direction">
          TOTTENHAM ATTACKING <ArrowRight size={14} />
        </span>
      </div>
      <div
        className="pitch"
        ref={surface}
        aria-label="Football tactics board. Tottenham attacks from left to right."
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
              <rect width="62.5" height="620" fill="white" opacity=".018" />
            </pattern>
            <marker
              id="arrow-head"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10"
                fill="none"
                stroke="#c2f778"
                strokeWidth="1.5"
              />
            </marker>
          </defs>
          <rect width="1000" height="620" fill="url(#grass)" />
          <g stroke="currentColor" strokeWidth="1.5">
            <rect x="22" y="22" width="956" height="576" rx="1" />
            <path d="M500 22V598" />
            <path d="M22 160H166V460H22 M978 160H834V460H978 M22 242H74V378H22 M978 242H926V378H978" />
            <path d="M166 243Q227 310 166 377 M834 243Q773 310 834 377" />
            <path d="M22 276H8V344H22 M978 276H992V344H978" opacity=".8" />
            <path d="M22 35Q35 35 35 22 M965 22Q965 35 978 35 M22 585Q35 585 35 598 M965 598Q965 585 978 585" />
          </g>
          <g fill="currentColor">
            <circle cx="500" cy="310" r="3" />
            <circle cx="125" cy="310" r="3" />
            <circle cx="875" cy="310" r="3" />
          </g>
          {start && target && (
            <g>
              {applied && (
                <ellipse
                  cx={target.targetX * 10}
                  cy={target.targetY * 6.2}
                  rx="73"
                  ry="115"
                  fill="#c2f778"
                  fillOpacity=".065"
                  stroke="#c2f778"
                  strokeOpacity=".25"
                  strokeDasharray="4 7"
                />
              )}
              <path
                d={`M${start.x * 10} ${start.y * 6.2} L${target.targetX * 10} ${target.targetY * 6.2}`}
                stroke="#c2f778"
                opacity=".8"
                strokeWidth="2.5"
                strokeDasharray="5 7"
                markerEnd="url(#arrow-head)"
              />
              <circle
                cx={target.targetX * 10}
                cy={target.targetY * 6.2}
                r="23"
                stroke="#c2f778"
                strokeWidth="1.5"
                strokeDasharray="3 4"
              />
            </g>
          )}
        </svg>
        {players.map((player) => (
          <motion.button
            key={player.id}
            type="button"
            className={`player ${player.team} ${dragging === player.id ? "dragging" : ""} ${mover?.id === player.id ? "recommended" : ""} ${applied && mover?.id === player.id ? "moved" : ""}`}
            data-player-id={player.id}
            data-x={player.x.toFixed(2)}
            data-y={player.y.toFixed(2)}
            aria-label={`${player.team === "tottenham" ? "Tottenham" : "Arsenal"} ${player.role}${player.team === "tottenham" ? ". Drag or use arrow keys to move" : ""}`}
            tabIndex={player.team === "tottenham" ? 0 : -1}
            aria-disabled={player.team === "arsenal"}
            initial={false}
            animate={{ left: `${player.x}%`, top: `${player.y}%` }}
            transition={{
              duration: reducedMotion || dragging === player.id ? 0 : 0.75,
              ease: [0.22, 1, 0.36, 1],
            }}
            onKeyDown={(event) => {
              if (
                player.team !== "tottenham" ||
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  event.key,
                )
              )
                return;
              event.preventDefault();
              const step = event.shiftKey ? 5 : 1;
              onMove(player.id, {
                x: clamp(
                  player.x +
                    (event.key === "ArrowRight"
                      ? step
                      : event.key === "ArrowLeft"
                        ? -step
                        : 0),
                ),
                y: clamp(
                  player.y +
                    (event.key === "ArrowDown"
                      ? step
                      : event.key === "ArrowUp"
                        ? -step
                        : 0),
                ),
              });
            }}
            onPointerDown={(event) => {
              if (
                player.team !== "tottenham" ||
                event.button !== 0 ||
                !surface.current
              )
                return;
              const rect = surface.current.getBoundingClientRect();
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                id: player.id,
                pointerId: event.pointerId,
                dx: ((event.clientX - rect.left) / rect.width) * 100 - player.x,
                dy: ((event.clientY - rect.top) / rect.height) * 100 - player.y,
              };
              setDragging(player.id);
            }}
            onPointerMove={(event) => {
              if (
                !drag.current ||
                drag.current.id !== player.id ||
                drag.current.pointerId !== event.pointerId ||
                !surface.current
              )
                return;
              const rect = surface.current.getBoundingClientRect();
              onMove(player.id, {
                x: clamp(
                  ((event.clientX - rect.left) / rect.width) * 100 -
                    drag.current.dx,
                ),
                y: clamp(
                  ((event.clientY - rect.top) / rect.height) * 100 -
                    drag.current.dy,
                ),
              });
            }}
            onPointerUp={() => {
              drag.current = null;
              setDragging(null);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragging(null);
            }}
            onLostPointerCapture={() => {
              drag.current = null;
              setDragging(null);
            }}
          >
            <span>{player.role}</span>
          </motion.button>
        ))}
        <div className="pitch-watermark" aria-hidden="true">
          THIRDMAN
        </div>
        {applied && analysis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pitch-annotation"
          >
            <span className="live-dot" /> {analysis.afterLabel}
          </motion.div>
        )}
      </div>
      <div className="pitch-bottom">
        <span>
          <Move size={13} /> Drag white players to explore a different shape
        </span>
        <span className="keyboard-tip">ARROW KEYS TO FINE-TUNE</span>
      </div>
    </>
  );
}
