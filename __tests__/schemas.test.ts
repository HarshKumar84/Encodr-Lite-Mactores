import { describe, expect, it } from "vitest";
import { sourceUrlSchema } from "@/lib/schemas";

describe("sourceUrlSchema", () => {
  describe("valid URLs", () => {
    it("accepts valid https URL with a path", () => {
      const result = sourceUrlSchema.safeParse("https://cdn.example.com/videos/clip.mp4");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("https://cdn.example.com/videos/clip.mp4");
      }
    });

    it("accepts valid http URL with nested path", () => {
      const result = sourceUrlSchema.safeParse("http://media.example.com/a/b/movie.mov");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("http://media.example.com/a/b/movie.mov");
      }
    });
  });

  describe("invalid URLs", () => {
    it("rejects empty string with 'Source URL is required'", () => {
      const result = sourceUrlSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Source URL is required");
      }
    });

    it("rejects malformed string that is not a URL", () => {
      const result = sourceUrlSchema.safeParse("not a url");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/valid url/i);
      }
    });

    it("rejects non-http/https protocol like ftp", () => {
      const result = sourceUrlSchema.safeParse("ftp://cdn.example.com/clip.mp4");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/http and https/i);
      }
    });

    it("rejects URL without a path component", () => {
      const result = sourceUrlSchema.safeParse("https://cdn.example.com");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/path/i);
      }
    });

    it("rejects URL with only a root slash as path", () => {
      const result = sourceUrlSchema.safeParse("https://cdn.example.com/");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/path/i);
      }
    });
  });
});
