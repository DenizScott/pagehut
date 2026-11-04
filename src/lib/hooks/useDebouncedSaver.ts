"use client";

import { useCallback, useEffect, useRef } from "react";
import { useStatus } from "@/lib/stores/status";

/**
 * Debounced save that always flushes: on unmount (page switch), tab hide and page unload.
 * The latest value wins; a failed save keeps the status at "error" and retries on the next change.
 */
export function useDebouncedSaver<T>(save: (value: T) => Promise<unknown>, delay = 300) {
  const setSave = useStatus((s) => s.setSave);
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
      if (!pending.current) setSave("saved");
    } catch (err) {
      console.error("[autosave] failed", err);
      setSave("error");
    }
  }, [setSave]);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      setSave("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush, setSave],
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
