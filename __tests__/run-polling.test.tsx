import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRunPolling } from "@/lib/client/use-run-polling";
import JobDetailPage from "@/app/(app)/jobs/[id]/page";
import { api } from "@/lib/client/api";
import type { EncodeRun, Job } from "@/lib/types";

describe("Task 5 — Live progress and useRunPolling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("useRunPolling hook", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("does nothing when runId is null", () => {
      const getSpy = vi.spyOn(api, "get");
      const { result } = renderHook(() => useRunPolling(null));

      expect(result.current.polling).toBe(false);
      expect(result.current.run).toBeNull();
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("fetches run immediately and then on interval", async () => {
      vi.useFakeTimers();
      const mockRun: EncodeRun = {
        id: "r_123",
        jobId: "j_1",
        stage: "DOWNLOADING",
        progressPct: 30,
        message: "Downloading source media…",
      };

      const getSpy = vi.spyOn(api, "get").mockResolvedValue(mockRun);

      const { result } = renderHook(() => useRunPolling("r_123"));

      // Immediate fetch triggered
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("/api/runs/r_123", undefined);

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.run?.stage).toBe("DOWNLOADING");
      expect(result.current.polling).toBe(true);

      // Advance by 1 second
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(getSpy).toHaveBeenCalledTimes(2);

      // Advance by another second
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(getSpy).toHaveBeenCalledTimes(3);
    });

    it("stops polling on COMPLETED and triggers onFinished", async () => {
      vi.useFakeTimers();
      const mockRun: EncodeRun = {
        id: "r_123",
        jobId: "j_1",
        stage: "COMPLETED",
        progressPct: 100,
        message: "Encode completed successfully",
        result: {
          durationSec: 184,
          renditions: [{ label: "1080p", width: 1920, height: 1080, sizeMb: 142.6 }],
        },
      };

      const getSpy = vi.spyOn(api, "get").mockResolvedValue(mockRun);
      const onFinished = vi.fn();

      const { result } = renderHook(() => useRunPolling("r_123", onFinished));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.polling).toBe(false);
      expect(result.current.run?.stage).toBe("COMPLETED");
      expect(onFinished).toHaveBeenCalledTimes(1);

      // Subsequent timer advances must NOT trigger more fetches
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(getSpy).toHaveBeenCalledTimes(1);
    });

    it("stops polling on FAILED", async () => {
      vi.useFakeTimers();
      const mockRun: EncodeRun = {
        id: "r_fail",
        jobId: "j_1",
        stage: "FAILED",
        progressPct: 67,
        message: "Transcoding failed: corrupt source media",
        error: "The source video appears corrupt.",
      };

      const getSpy = vi.spyOn(api, "get").mockResolvedValue(mockRun);
      const onFinished = vi.fn();

      const { result } = renderHook(() => useRunPolling("r_fail", onFinished));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.polling).toBe(false);
      expect(result.current.run?.stage).toBe("FAILED");
      expect(onFinished).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(getSpy).toHaveBeenCalledTimes(1);
    });

    it("cleans up interval on unmount", async () => {
      vi.useFakeTimers();
      const mockRun: EncodeRun = {
        id: "r_123",
        jobId: "j_1",
        stage: "TRANSCODING",
        progressPct: 50,
        message: "Transcoding renditions…",
      };

      const getSpy = vi.spyOn(api, "get").mockResolvedValue(mockRun);

      const { unmount } = renderHook(() => useRunPolling("r_123"));

      await act(async () => {
        await Promise.resolve();
      });
      expect(getSpy).toHaveBeenCalledTimes(1);

      unmount();

      // Advancing time should not trigger any fetches after unmount
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(getSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("JobDetailPage run panel", () => {
    function renderDetail(paramsPromise: Promise<{ id: string }>) {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      return render(
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<div>Loading suspense...</div>}>
            <JobDetailPage params={paramsPromise} />
          </Suspense>
        </QueryClientProvider>,
      );
    }

    it("renders idle state with 'Start encode' button when no run has occurred", async () => {
      const mockJob: Job = {
        id: "j_100",
        title: "Test Movie",
        sourceUrl: "https://cdn.example.com/videos/movie.mp4",
        status: "NEW",
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(api, "get").mockResolvedValue(mockJob);

      await act(async () => {
        renderDetail(Promise.resolve({ id: "j_100" }));
      });

      expect(await screen.findByRole("button", { name: /start encode/i })).toBeInTheDocument();
      expect(screen.getByText("Test Movie")).toBeInTheDocument();
    });

    it("displays error panel and 'Retry encode' button when run fails", async () => {
      const mockJob: Job = {
        id: "j_101",
        title: "Corrupt Video",
        sourceUrl: "https://cdn.example.com/videos/corrupt.mp4",
        status: "FAILED",
        createdAt: new Date().toISOString(),
        latestRunId: "r_fail_1",
      };

      const mockRun: EncodeRun = {
        id: "r_fail_1",
        jobId: "j_101",
        stage: "FAILED",
        progressPct: 67,
        message: "Transcoding failed: corrupt source media",
        error: "The source video appears corrupt and cannot be transcoded.",
      };

      vi.spyOn(api, "get").mockImplementation(async (path: string) => {
        if (path === "/api/jobs/j_101") return mockJob;
        if (path === "/api/runs/r_fail_1") return mockRun;
        throw new Error("Not found");
      });

      await act(async () => {
        renderDetail(Promise.resolve({ id: "j_101" }));
      });

      expect(await screen.findByText("Encode failed")).toBeInTheDocument();
      expect(
        screen.getByText("The source video appears corrupt and cannot be transcoded."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry encode/i })).toBeInTheDocument();
    });

    it("displays renditions table when run is completed", async () => {
      const mockJob: Job = {
        id: "j_102",
        title: "Completed Video",
        sourceUrl: "https://cdn.example.com/videos/done.mp4",
        status: "COMPLETED",
        createdAt: new Date().toISOString(),
        latestRunId: "r_comp_1",
      };

      const mockRun: EncodeRun = {
        id: "r_comp_1",
        jobId: "j_102",
        stage: "COMPLETED",
        progressPct: 100,
        message: "Encode completed successfully",
        result: {
          durationSec: 184,
          renditions: [
            { label: "1080p", width: 1920, height: 1080, sizeMb: 142.6 },
            { label: "720p", width: 1280, height: 720, sizeMb: 68.3 },
          ],
        },
      };

      vi.spyOn(api, "get").mockImplementation(async (path: string) => {
        if (path === "/api/jobs/j_102") return mockJob;
        if (path === "/api/runs/r_comp_1") return mockRun;
        throw new Error("Not found");
      });

      await act(async () => {
        renderDetail(Promise.resolve({ id: "j_102" }));
      });

      expect(await screen.findByText("Transcoded Renditions")).toBeInTheDocument();
      expect(screen.getByText("1080p")).toBeInTheDocument();
      expect(screen.getByText("720p")).toBeInTheDocument();
      expect(screen.getByText("Duration: 184s")).toBeInTheDocument();
    });
  });
});
