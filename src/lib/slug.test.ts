import { describe, it, expect, vi } from "vitest";
import { generateBaseSlug, generateUniqueSlug } from "@/lib/slug";
import type { SupabaseClient } from "@supabase/supabase-js";

interface MockSupabase {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

describe("Slug Utilities", () => {
  describe("generateBaseSlug", () => {
    it("should convert Turkish characters and spaces to hyphens", () => {
      expect(generateBaseSlug("Test İşletme")).toBe("test-isletme");
      expect(generateBaseSlug("Berber Salonu")).toBe("berber-salonu");
    });

    it("should remove special characters", () => {
      expect(generateBaseSlug("Test @ İşletme!")).toBe("test-isletme");
      expect(generateBaseSlug("A&B/C")).toBe("a-b-c");
    });

    it("should handle multiple spaces", () => {
      expect(generateBaseSlug("Test    İşletme")).toBe("test-isletme");
    });

    it("should trim leading/trailing hyphens", () => {
      expect(generateBaseSlug("  Test  ")).toBe("test");
    });

    it("should handle empty string", () => {
      expect(generateBaseSlug("")).toBe("");
    });
  });

  describe("generateUniqueSlug", () => {
    it("should generate unique slug when no conflict", async () => {
      const mockSupabase: MockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
      };

      const slug = await generateUniqueSlug(mockSupabase as unknown as SupabaseClient<any, any, any>, "test-slug");
      expect(slug).toBe("test-slug");
    });

    it("should append suffix when conflict exists", async () => {
      let callCount = 0;
      const mockSupabase: MockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ data: { id: "1" }, error: null });
          }
          return Promise.resolve({ data: null, error: { code: "PGRST116" } });
        }),
      };

      const slug = await generateUniqueSlug(mockSupabase as unknown as SupabaseClient<any, any, any>, "test-slug");
      expect(slug).toMatch(/^test-slug-[a-z0-9]{4}$/);
    });

    it("should fallback to timestamp after max attempts", async () => {
      const mockSupabase: MockSupabase = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "1" }, error: null }),
      };

      const slug = await generateUniqueSlug(mockSupabase as unknown as SupabaseClient<any, any, any>, "test-slug", 3);
      expect(slug).toMatch(/^test-slug-[a-z0-9]+$/);
    });
  });
});