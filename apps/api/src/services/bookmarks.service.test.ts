import { describe, expect, it } from "vitest";
import { createTestBookmark, createTestPost, createTestUser } from "../../tests/helpers";
import { getBookmarkedPosts, getBookmarkStatus, toggleBookmark } from "./bookmarks.service";

/**
 */
describe("BookmarksService", () => {
	describe("toggleBookmark", () => {
		it("adds a bookmark when post is not bookmarked", async () => {
			const author = await createTestUser();
			const user = await createTestUser();
			const postId = await createTestPost(author.id, "Bookmark post test");

			const result = await toggleBookmark(postId, user.id);
			expect(result.bookmarked).toBe(true);

			const status = await getBookmarkStatus(postId, user.id);
			expect(status.bookmarked).toBe(true);
		});

		it("removes a bookmark when post is already bookmarked", async () => {
			const author = await createTestUser();
			const user = await createTestUser();
			const postId = await createTestPost(author.id, "Bookmark post test");

			await toggleBookmark(postId, user.id); // Bookmark it
			const result = await toggleBookmark(postId, user.id); // Un-bookmark it

			expect(result.bookmarked).toBe(false);

			const status = await getBookmarkStatus(postId, user.id);
			expect(status.bookmarked).toBe(false);
		});
	});

	describe("getBookmarkedPosts", () => {
		it("returns user bookmarked posts with author and count enrichment", async () => {
			const author = await createTestUser();
			const user = await createTestUser();
			const postId1 = await createTestPost(author.id, "Bookmarked Post 1");
			const postId2 = await createTestPost(author.id, "Bookmarked Post 2");

			await createTestBookmark(user.id, postId1);
			await createTestBookmark(user.id, postId2);

			const bookmarkedPosts = await getBookmarkedPosts(user.id, user.id, 10, 0);
			expect(bookmarkedPosts).toHaveLength(2);
			expect(bookmarkedPosts[0].author?.username).toBe(author.username);
			expect(bookmarkedPosts[0].likeCount).toBe(0);
		});

		it("returns empty array for user with no bookmarks", async () => {
			const user = await createTestUser();
			const bookmarkedPosts = await getBookmarkedPosts(user.id, user.id, 10, 0);
			expect(bookmarkedPosts).toHaveLength(0);
		});
	});

	describe("getBookmarkStatus", () => {
		it("returns false for non-bookmarked post", async () => {
			const user = await createTestUser();
			const status = await getBookmarkStatus("nonexistent-post", user.id);
			expect(status.bookmarked).toBe(false);
		});
	});
});
