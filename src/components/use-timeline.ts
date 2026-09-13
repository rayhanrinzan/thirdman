"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export function useTimeline(duration: number) {
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false);
  const clock = useRef(0);
  const seek = useCallback((next: number) => {
    clock.current = next;
    setTime(next);
  }, []);
  const stop = useCallback(() => {
    setPlaying(false);
    clock.current = 0;
    setTime(0);
  }, []);
  useEffect(() => {
    if (!playing || duration <= 0) return;
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(now - previous, 100);
      previous = now;
      clock.current = Math.min(duration, clock.current + delta);
      setTime(clock.current);
      if (clock.current >= duration) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const pauseHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pauseHidden);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", pauseHidden);
    };
  }, [playing, duration]);
  return { time, playing, seek, stop, setPlaying };
}
