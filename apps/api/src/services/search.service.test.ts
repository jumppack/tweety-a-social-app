import { describe, expect, it } from "vitest";
import { createTestPost, createTestUser } from "../../tests/helpers";
import { searchPosts, searchUsers } from "./search.service";

/**
 */
describe("SearchService", () => {
	describe("searchPosts", () => {
		it("finds posts matching content query", async () => {
			const author = await createTestUser();
			await createTestPost(author.id, "Learning TypeScript and Vitest");
			await createTestPost(author.id, "Cooking pasta at home");

			const results = await searchPosts("TypeScript");
			expect(results).toHaveLength(1);
			expect(results[0].content).toContain("TypeScript");
		});

		it("returns empty array for empty search query", async () => {
			const results = await searchPosts("");
			expect(results).toHaveLength(0);
		});

		it("returns empty array when no posts match", async () => {
			const results = await searchPosts("nonexistentkeyword123");
			expect(results).toHaveLength(0);
		});
	});

	describe("searchUsers", () => {
		it("finds users matching username or display name", async () => {
			await createTestUser({ username: "john_doe", displayName: "John Doe" });
			await createTestUser({ username: "jane_smith", displayName: "Jane Smith" });

			const results = await searchUsers("John");
			expect(results).toHaveLength(1);
			expect(results[0].username).toBe("john_doe");
		});

		it("returns empty array for empty query", async () => {
			const results = await searchUsers("   ");
			expect(results).toHaveLength(0);
		});
	});
});
