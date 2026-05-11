"use client";

import { useCallback, useEffect, useRef } from "react";

const DEFAULT_DELAY_MS = 400;
const DEFAULT_MOVE_THRESHOLD_PX = 6;

interface Options {
  delay?: number;
  moveThreshold?: number;
}

export function useLongPress(onLongPress: () => void, options: Options = {}) {
  const { delay = DEFAULT_DELAY_MS, moveThreshold = DEFAULT_MOVE_THRESHOLD_PX } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const onLongPressRef = useRef(onLongPress);

  useEffect(() => {
    onLongPressRef.current = onLongPress;
  }, [onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") return;
      cancel();
      startPosRef.current = { x: event.clientX, y: event.clientY };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        startPosRef.current = null;
        try {
          navigator.vibrate?.(10);
        } catch {
          // vibrate not supported
        }
        onLongPressRef.current();
      }, delay);
    },
    [cancel, delay],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!startPosRef.current || timerRef.current === null) return;
      const dx = event.clientX - startPosRef.current.x;
      const dy = event.clientY - startPosRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > moveThreshold) {
        cancel();
      }
    },
    [cancel, moveThreshold],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
  };
}
