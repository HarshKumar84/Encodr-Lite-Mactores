import { describe, expect, it } from "vitest";
import { computeRun, FAIL_URL, type RunRecord } from "@/lib/server/store";
import { TIMELINE } from "@/lib/types";

describe("computeRun() state machine", () => {
  const startedAt = 1_700_000_000_000;
  const normalRecord: RunRecord = {
    id: "r_test1",
    jobId: "j_test1",
    sourceUrl: "https://cdn.example.com/videos/sample.mp4",
    startedAt,
  };

  const corruptRecord: RunRecord = {
    id: "r_corrupt",
    jobId: "j_test2",
    sourceUrl: FAIL_URL,
    startedAt,
  };

  describe("stage boundaries for normal runs", () => {
    it("starts in QUEUED at elapsed 0 with progress 0", () => {
      const run = computeRun(normalRecord, startedAt);
      expect(run.stage).toBe("QUEUED");
      expect(run.progressPct).toBe(0);
      expect(run.error).toBeUndefined();
      expect(run.result).toBeUndefined();
      expect(run.message).toBeTruthy();
    });

    it("remains in QUEUED at 1999ms (just before 2000ms boundary)", () => {
      const run = computeRun(normalRecord, startedAt + TIMELINE.queuedEndsMs - 1);
      expect(run.stage).toBe("QUEUED");
      expect(run.error).toBeUndefined();
      expect(run.result).toBeUndefined();
    });

    it("transitions to DOWNLOADING exactly at 2000ms", () => {
      const run = computeRun(normalRecord, startedAt + TIMELINE.queuedEndsMs);
      expect(run.stage).toBe("DOWNLOADING");
      expect(run.progressPct).toBeGreaterThan(0);
      expect(run.error).toBeUndefined();
      expect(run.result).toBeUndefined();
    });

    it("remains in DOWNLOADING at 5999ms (just before 6000ms boundary)", () => {
      const run = computeRun(normalRecord, startedAt + TIMELINE.downloadingEndsMs - 1);
      expect(run.stage).toBe("DOWNLOADING");
    });

    it("transitions to TRANSCODING exactly at 6000ms", () => {
      const run = computeRun(normalRecord, startedAt + TIMELINE.downloadingEndsMs);
      expect(run.stage).toBe("TRANSCODING");
      expect(run.progressPct).toBe(50);
      expect(run.error).toBeUndefined();
      expect(run.result).toBeUndefined();
    });

    it("normal URL continues TRANSCODING through 8000ms", () => {
      const run = computeRun(normalRecord, startedAt + TIMELINE.failAtMs);
      expect(run.stage).toBe("TRANSCODING");
      expect(run.error).toBeUndefined();
    });

    it("remains in TRANSCODING at 11999ms (just before 12000ms)", () => {
      const run = computeRun(normalRecord, startedAt + TIMELINE.transcodingEndsMs - 1);
      expect(run.stage).toBe("TRANSCODING");
      expect(run.result).toBeUndefined();
    });

    it("transitions to COMPLETED exactly at 12000ms with progress 100 and result set", () => {
      const run = computeRun(normalRecord, startedAt + TIMELINE.transcodingEndsMs);
      expect(run.stage).toBe("COMPLETED");
      expect(run.progressPct).toBe(100);
      expect(run.error).toBeUndefined();
      expect(run.result).toBeDefined();
      expect(run.result?.renditions).toHaveLength(3);
    });

    it("stays COMPLETED with progress 100 well after 12000ms", () => {
      const run = computeRun(normalRecord, startedAt + 30_000);
      expect(run.stage).toBe("COMPLETED");
      expect(run.progressPct).toBe(100);
      expect(run.result).toBeDefined();
      expect(run.error).toBeUndefined();
    });
  });

  describe("corrupt URL failure path (FAIL_URL)", () => {
    it("behaves normally before 8000ms (QUEUED at 1s)", () => {
      const run = computeRun(corruptRecord, startedAt + 1_000);
      expect(run.stage).toBe("QUEUED");
      expect(run.error).toBeUndefined();
    });

    it("behaves normally before 8000ms (DOWNLOADING at 4s)", () => {
      const run = computeRun(corruptRecord, startedAt + 4_000);
      expect(run.stage).toBe("DOWNLOADING");
      expect(run.error).toBeUndefined();
    });

    it("behaves normally before 8000ms (TRANSCODING at 7999ms)", () => {
      const run = computeRun(corruptRecord, startedAt + TIMELINE.failAtMs - 1);
      expect(run.stage).toBe("TRANSCODING");
      expect(run.error).toBeUndefined();
    });

    it("transitions to FAILED exactly at 8000ms with error message and no result", () => {
      const run = computeRun(corruptRecord, startedAt + TIMELINE.failAtMs);
      expect(run.stage).toBe("FAILED");
      expect(run.error).toBeDefined();
      expect(run.result).toBeUndefined();
      expect(run.progressPct).toBe(67); // frozen at fail point ~67%
    });

    it("remains FAILED with frozen progress even past 12000ms", () => {
      const run = computeRun(corruptRecord, startedAt + 15_000);
      expect(run.stage).toBe("FAILED");
      expect(run.error).toBeDefined();
      expect(run.result).toBeUndefined();
      expect(run.progressPct).toBe(67);
    });
  });

  describe("progress monotonicity", () => {
    it("never moves backwards as time elapses", () => {
      let prevProgress = -1;
      for (let ms = 0; ms <= TIMELINE.transcodingEndsMs; ms += 500) {
        const run = computeRun(normalRecord, startedAt + ms);
        expect(run.progressPct).toBeGreaterThanOrEqual(prevProgress);
        expect(run.progressPct).toBeLessThanOrEqual(100);
        prevProgress = run.progressPct;
      }
    });
  });
});
