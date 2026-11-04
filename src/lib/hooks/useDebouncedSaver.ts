"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { useStatus } from "@/lib/stores/status";

/**
 * Debounced save that always flushes: on unmount (page switch), tab hide and page unload.
 * The latest value wins. Each saver reports to the shared status by its own id, so the top bar
 * only says "saved" once every saver has finished.
 */
export function useDebouncedSaver<T>(save: (value: T) => Promise<unknown>, delay = 300) {
  const saverId = useId();
  const markPending = useStatus((s) => s.markPending);
  const markSaved = useStatus((s) => s.markSaved);
  const markFailed = useStatus((s) => s.markFailed);
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const item = pending.current;
    if (!item) return;
    pending.current = null;
    try {
      await saveRef.current(item.value);
      // A newer value may have been scheduled while this one was being written.
      if (!pending.current) markSaved(saverId);
    } catch (err) {
      console.error("[autosave] failed", err);
      markFailed(saverId);
    }
  }, [markFailed, markSaved, saverId]);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      markPending(saverId);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush, markPending, saverId],
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  return { schedule, flush };
}
