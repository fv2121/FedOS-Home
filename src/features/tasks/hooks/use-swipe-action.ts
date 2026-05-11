"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const REVEAL_RATIO = 0.25;
const COMMIT_RATIO = 0.60;
const RIGHT_EDGE_GUARD_PX = 24;
const DIRECTION_LOCK_PX = 4;
const HORIZONTAL_DOMINANCE = 1.5; // dx/dy must exceed this to lock horizontal
const SETTLE_MS = 220;

export type SwipePhase = "idle" | "dragging" | "revealed" | "committing" | "settling";

interface PointerStart {
  x: number;
  y: number;
  cardWidth: number;
  pointerId: number;
}

export function useSwipeAction(onCommit: () => void) {
  const [translateX, setTranslateX] = useState(0);
  const [phase, setPhase] = useState<SwipePhase>("idle");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const startRef = useRef<PointerStart | null>(null);
  const directionRef = useRef<"none" | "horizontal" | "vertical">("none");
  const translateXRef = useRef(0);
  const onCommitRef = useRef(onCommit);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const snapBack = useCallback(() => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setIsTransitioning(true);
    setTranslateX(0);
    translateXRef.current = 0;
    setPhase("idle");
    settleTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
      settleTimerRef.current = null;
    }, SETTLE_MS);
  }, []);

  // Exposes ref-based check — safe to call inside event handlers without stale closure issues.
  const isActivelyDragging = useCallback(() => {
    return directionRef.current === "horizontal" || translateXRef.current !== 0;
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;

    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX > rect.right - RIGHT_EDGE_GUARD_PX) return;

    startRef.current = {
      x: event.clientX,
      y: event.clientY,
      cardWidth: rect.width,
      pointerId: event.pointerId,
    };
    directionRef.current = "none";
    setIsTransitioning(false);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const start = startRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const rawDx = start.x - event.clientX; // positive = swiped left
    const rawDy = Math.abs(event.clientY - start.y);

    if (directionRef.current === "none") {
      const movement = Math.max(Math.abs(rawDx), rawDy);
      if (movement < DIRECTION_LOCK_PX) return;

      if (rawDx > 0 && rawDx / Math.max(rawDy, 1) >= HORIZONTAL_DOMINANCE) {
        directionRef.current = "horizontal";
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // setPointerCapture may fail in some environments
        }
      } else {
        directionRef.current = "vertical";
        startRef.current = null;
        return;
      }
    }

    if (directionRef.current !== "horizontal") return;

    if (rawDx <= 0) {
      if (translateXRef.current !== 0) {
        translateXRef.current = 0;
        setTranslateX(0);
        setPhase("idle");
      }
      return;
    }

    const clampedDx = Math.min(rawDx, start.cardWidth * 0.8);
    const newTx = -clampedDx;
    translateXRef.current = newTx;
    setTranslateX(newTx);

    const ratio = clampedDx / start.cardWidth;
    if (ratio >= COMMIT_RATIO) {
      setPhase("committing");
    } else if (ratio >= REVEAL_RATIO) {
      setPhase("revealed");
    } else {
      setPhase("dragging");
    }
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const start = startRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const cardWidth = start.cardWidth;
    const currentTx = translateXRef.current;
    startRef.current = null;
    directionRef.current = "none";

    const ratio = Math.abs(currentTx) / cardWidth;

    if (ratio >= COMMIT_RATIO) {
      setIsTransitioning(true);
      setTranslateX(-cardWidth);
      translateXRef.current = -cardWidth;
      setPhase("settling");

      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        onCommitRef.current();
        // Component will likely unmount from optimistic delete, but reset defensively.
        translateXRef.current = 0;
        setTranslateX(0);
        setIsTransitioning(false);
        setPhase("idle");
      }, SETTLE_MS);
    } else {
      snapBack();
    }
  }, [snapBack]);

  const onPointerCancel = useCallback(() => {
    startRef.current = null;
    directionRef.current = "none";
    snapBack();
  }, [snapBack]);

  return {
    translateX,
    phase,
    isTransitioning,
    isActivelyDragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
