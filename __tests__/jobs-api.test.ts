import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/jobs/route";
import { issueToken } from "@/lib/server/auth";
import { __resetStore } from "@/lib/server/store";

describe("Jobs API routes", () => {
  const validToken = issueToken("u_demo");

  beforeEach(() => {
    __resetStore();
  });

  describe("GET /api/jobs", () => {
    it("returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3000/api/jobs");
      const res = await GET(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.detail).toBe("Not authenticated");
    });

    it("returns 200 with an array of jobs when authenticated", async () => {
      const req = new Request("http://localhost:3000/api/jobs", {
        headers: { authorization: `Bearer ${validToken}` },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });

  describe("POST /api/jobs", () => {
    it("returns 401 when unauthenticated", async () => {
      const req = new Request("http://localhost:3000/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl: "https://cdn.example.com/videos/clip.mp4" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 422 with fieldErrors when sourceUrl is invalid", async () => {
      const req = new Request("http://localhost:3000/api/jobs", {
        method: "POST",
        headers: {
          authorization: `Bearer ${validToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sourceUrl: "nope" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.detail).toBe("Validation failed");
      expect(data.fieldErrors).toBeDefined();
      expect(data.fieldErrors.sourceUrl).toBeDefined();
      expect(data.fieldErrors.sourceUrl.length).toBeGreaterThan(0);
    });

    it("creates a job and returns 201 on valid input", async () => {
      const req = new Request("http://localhost:3000/api/jobs", {
        method: "POST",
        headers: {
          authorization: `Bearer ${validToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sourceUrl: "https://cdn.example.com/videos/clip.mp4",
          title: "Sample Clip",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const created = await res.json();
      expect(created.id).toMatch(/^j_/);
      expect(created.title).toBe("Sample Clip");
      expect(created.sourceUrl).toBe("https://cdn.example.com/videos/clip.mp4");
      expect(created.status).toBe("NEW");

      // Verify it appears in GET /api/jobs
      const getReq = new Request("http://localhost:3000/api/jobs", {
        headers: { authorization: `Bearer ${validToken}` },
      });
      const getRes = await GET(getReq);
      const list = await getRes.json();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(created.id);
    });
  });
});
