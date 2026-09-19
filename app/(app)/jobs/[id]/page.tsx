"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useJob, useStartRun } from "@/lib/client/hooks";
import { useRunPolling } from "@/lib/client/use-run-polling";
import { StatusBadge } from "@/components/status-badge";
import { ProgressBar } from "@/components/progress-bar";

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const jobQuery = useJob(id);
  const startRunMutation = useStartRun(id);

  const job = jobQuery.data;
  const [activeRunId, setActiveRunId] = useState<string | null>(job?.latestRunId ?? null);

  useEffect(() => {
    if (job?.latestRunId && !activeRunId) {
      setActiveRunId(job.latestRunId);
    }
  }, [job?.latestRunId, activeRunId]);

  const pollingState = useRunPolling(activeRunId, () => {
    jobQuery.refetch();
  });

  if (jobQuery.isLoading) {
    return <p className="text-sm text-neutral-500">Loading job…</p>;
  }

  if (jobQuery.isError || !job) {
    return (
      <div className="text-sm text-red-600">
        Job not found.{" "}
        <Link href="/jobs" className="underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const handleStartOrRetry = async () => {
    try {
      const res = await startRunMutation.mutateAsync();
      setActiveRunId(res.runId);
    } catch {
      // Error available via startRunMutation.error
    }
  };

  const run = pollingState.run;
  const isStarting = startRunMutation.isPending;

  // Explicit single state derivation: idle | starting | loading_run | running | failed | completed
  const screenMode = (() => {
    if (isStarting) return "starting" as const;
    if (!activeRunId) return "idle" as const;
    if (!run) return "loading_run" as const;
    if (run.stage === "FAILED") return "failed" as const;
    if (run.stage === "COMPLETED") return "completed" as const;
    return "running" as const;
  })();

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-neutral-500 hover:underline">
        ← All jobs
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{job.title}</h1>
          <p className="truncate text-sm text-neutral-500">{job.sourceUrl}</p>
        </div>
        <StatusBadge value={job.status} />
      </div>

      {startRunMutation.error && (
        <p className="text-sm text-red-600">{startRunMutation.error.message}</p>
      )}

      {pollingState.fetchError && (
        <p className="text-sm text-amber-600">Network warning: {pollingState.fetchError}</p>
      )}

      <section className="rounded-md border border-neutral-200 p-5 space-y-4">
        {screenMode === "idle" && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">Ready to transcode. Click Start encode to begin.</p>
            <button
              onClick={handleStartOrRetry}
              disabled={isStarting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Start encode
            </button>
          </div>
        )}

        {screenMode === "starting" && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-500">Starting encode run…</p>
            <button
              disabled
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Starting encode…
            </button>
          </div>
        )}

        {screenMode === "loading_run" && (
          <p className="text-sm text-neutral-500">Connecting to encoder…</p>
        )}

        {(screenMode === "running" || screenMode === "completed" || screenMode === "failed") && run && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Stage:</span>
                <StatusBadge value={run.stage} />
              </div>
              <span className="text-sm font-medium text-neutral-600">
                {run.progressPct}%
              </span>
            </div>

            <ProgressBar value={run.progressPct} failed={screenMode === "failed"} />

            {screenMode === "failed" && (
              <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">Encode failed</p>
                <p className="text-xs text-red-700">{run.error || run.message}</p>
                <div>
                  <button
                    onClick={handleStartOrRetry}
                    disabled={isStarting}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isStarting ? "Starting…" : "Retry encode"}
                  </button>
                </div>
              </div>
            )}

            {screenMode === "completed" && run.result && (
              <div className="space-y-3 rounded-md border border-neutral-200 p-4">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                  <h3 className="text-sm font-semibold">Transcoded Renditions</h3>
                  <span className="text-xs text-neutral-500">
                    Duration: {run.result.durationSec}s
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-neutral-200 text-neutral-500">
                      <tr>
                        <th className="py-2 px-3">Rendition</th>
                        <th className="py-2 px-3">Resolution</th>
                        <th className="py-2 px-3">Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {run.result.renditions.map((r, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-medium">{r.label}</td>
                          <td className="py-2 px-3 text-neutral-600">
                            {r.width} &times; {r.height}
                          </td>
                          <td className="py-2 px-3 text-neutral-600">{r.sizeMb} MB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {pollingState.log.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Encode Log
                </p>
                <div className="space-y-1 rounded bg-neutral-900 p-3 font-mono text-xs text-neutral-100">
                  {pollingState.log.map((msg, idx) => (
                    <p key={idx} className="truncate">
                      &gt; {msg}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
