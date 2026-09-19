"use client";

import { useEffect, useRef, useState } from "react";
import { isTerminalStage, type EncodeRun } from "@/lib/types";
import { fetchRun } from "@/lib/client/hooks";

export interface RunPollingState {
  /** The latest run state we've received, or null before the first response. */
  run: EncodeRun | null;
  /** True while we're still asking the server for updates. */
  polling: boolean;
  /** A request failed (network, 404, …). Not the same thing as the RUN failing. */
  fetchError: string | null;
  /** Every message we've seen, oldest first — the log the UI renders. */
  log: string[];
}

const initialState: RunPollingState = {
  run: null,
  polling: false,
  fetchError: null,
  log: [],
};

/**
 * TASK 5 — TODO(candidate): poll a run until it finishes.
 *
 * The server does not push anything to us. To show live progress, we ask "what's the state of
 * this run?" roughly once a second, until the run reaches a terminal stage (COMPLETED or FAILED).
 *
 * What this hook must do:
 *   1. When `runId` is null, do nothing at all.
 *   2. When `runId` is set, fetch the run immediately, then keep fetching about once a second.
 *   3. Track the latest run in state, and append each new `message` to `log`
 *      (don't append the same message twice in a row — the same stage repeats across polls).
 *   4. STOP polling once `isTerminalStage(run.stage)` is true, and call `onFinished?.()` so the
 *      page can refresh the job's status.
 *   5. CLEAN UP: when the component unmounts, or when `runId` changes, stop the timer and don't
 *      write to state any more.
 *
 * Point 5 is the one that separates a working version from a correct one, so here's the shape of
 * the answer. A useEffect can return a cleanup function, which React calls before the next run of
 * the effect and when the component unmounts:
 *
 *     useEffect(() => {
 *       let cancelled = false;                    // ← the guard
 *       const id = setInterval(() => {
 *         if (cancelled) return;
 *         // ...do the work
 *       }, 1000);
 *
 *       return () => {                            // ← the cleanup
 *         cancelled = true;
 *         clearInterval(id);
 *       };
 *     }, [runId]);
 *
 * Two separate problems are being solved there, and you need both:
 *   - `clearInterval` stops future ticks. Without it, navigating away leaves a timer hammering
 *     the API forever, and mounting the page a few times gives you several timers at once.
 *   - `cancelled` handles the request that's ALREADY in flight. A fetch started just before
 *     unmount will still resolve afterwards; calling setState at that point updates a component
 *     that no longer exists. Check the flag after every `await` before touching state.
 *
 * To see whether you got it right: add a `console.log` on each poll, start a run, then navigate
 * back to the jobs list before it finishes. The logs should stop. If they don't, the cleanup
 * isn't working — and this is exactly the bug we'll ask you about in the interview.
 */
export function useRunPolling(runId: string | null, onFinished?: () => void): RunPollingState {
  const [state, setState] = useState<RunPollingState>(initialState);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    if (!runId) {
      setState(initialState);
      return;
    }

    let cancelled = false;
    let stopped = false;
    let timerId: ReturnType<typeof setInterval> | null = null;

    setState({
      run: null,
      polling: true,
      fetchError: null,
      log: [],
    });

    async function poll() {
      if (cancelled || stopped) return;
      try {
        const run = await fetchRun(runId!);
        if (cancelled || stopped) return;

        const terminal = isTerminalStage(run.stage);
        if (terminal) {
          stopped = true;
          if (timerId !== null) {
            clearInterval(timerId);
            timerId = null;
          }
        }

        setState((prev) => {
          const newLog =
            run.message && prev.log[prev.log.length - 1] !== run.message
              ? [...prev.log, run.message]
              : prev.log;

          return {
            run,
            polling: !terminal,
            fetchError: null,
            log: newLog,
          };
        });

        if (terminal) {
          onFinishedRef.current?.();
        }
      } catch (err) {
        if (cancelled || stopped) return;
        setState((prev) => ({
          ...prev,
          fetchError: err instanceof Error ? err.message : "Failed to fetch run",
        }));
      }
    }

    poll();

    if (!stopped) {
      timerId = setInterval(poll, 1000);
    }

    return () => {
      cancelled = true;
      stopped = true;
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    };
  }, [runId]);

  return state;
}
