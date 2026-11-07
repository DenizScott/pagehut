"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { clearPending, stashPending } from "@/lib/storage/pending-edits";
import { useStatus } from "@/lib/stores/status";

/**
 * Debounced save that always flushes: on unmount (page switch), tab hide and page unload.
 * The latest value wins. Each saver reports to the shared status by its own id, so the top bar
 * only says "saved" once every saver has finished.
 *
 * `stashKey` (see lib/storage/pending-edits.ts): on page unload a pending value is also written to
 * localStorage synchronously, because the asynchronous IndexedDB write may not finish before the
 * page is gone. The next start of the app applies it.
 */
export function useDebouncedSaver<T>(save: (value: T) => Promise<unknown>, delay = 300, stashKey?: string) {
  const saverId = useId();
  const markPending = useStatus((s) => s.markPending);
  const markSaved = useStatus((s) => s.markSaved);
  const markFailed = useStatus((s) => s.markFailed);
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  const stashed = useRef(false);

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
      if (!pending.current) {
        markSaved(saverId);
        if (stashKey && stashed.current) {
          clearPending(stashKey); // the page survived (e.g. only hidden): the stash is not needed
          stashed.current = false;
        }
      }
    } catch (err) {
      console.error("[autosave] failed", err);
      markFailed(saverId);
    }
  }, [markFailed, markSaved, saverId, stashKey]);

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
    const onPageHide = () => {
      // Synchronous safety copy first; then try the normal save.
      if (stashKey && pending.current) {
        stashPending(stashKey, pending.current.value);
        stashed.current = true;
      }
      void flush();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") onPageHide();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush, stashKey]);

  return { schedule, flush };
}
