import { useRef, useEffect, useCallback } from "react";

/**
 * Adds pull-to-refresh gesture on mobile.
 * Attach the returned ref to the scrollable container.
 */
export function usePullRefresh(onRefresh: () => Promise<void> | void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current;
    if (!el || el.scrollTop > 5) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!pulling.current) return;
      const diff = e.changedTouches[0].clientY - startY.current;
      pulling.current = false;
      if (diff > 80) {
        // Trigger haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(30);
        onRefresh();
      }
    },
    [onRefresh],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return containerRef;
}

/** Trigger haptic feedback (vibration) on supported devices */
export function haptic(ms = 15) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
