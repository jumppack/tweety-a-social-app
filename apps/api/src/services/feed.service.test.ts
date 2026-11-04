import { describe, expect, it } from "vitest";
import {
	createTestFollow,
	createTestLike,
	createTestPost,
	createTestUser,
} from "../../tests/helpers";
import { getExploreFeed, getHomeFeed } from "./feed.service";

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

describe("FeedService", () => {
	describe("getHomeFeed", () => {
		it("includes own posts and posts from followed users only", async () => {
			const viewer = await createTestUser();
			const followed = await createTestUser();
			const stranger = await createTestUser();
			await createTestFollow(viewer.id, followed.id);

			const own = await createTestPost(viewer.id, "mine");
			const fromFollowed = await createTestPost(followed.id, "followed");
			await createTestPost(stranger.id, "stranger");

			const feed = await getHomeFeed(viewer.id);
			expect(feed.map((p) => p.id).sort()).toEqual([own, fromFollowed].sort());
		});

		it("returns only own posts when following nobody", async () => {
			const viewer = await createTestUser();
			const other = await createTestUser();
			const own = await createTestPost(viewer.id);
			await createTestPost(other.id);

			const feed = await getHomeFeed(viewer.id);
			expect(feed.map((p) => p.id)).toEqual([own]);
		});

		it("orders newest first and honours limit/offset", async () => {
			const viewer = await createTestUser();
			const oldest = await createTestPost(viewer.id, "a", { createdAt: minutesAgo(30) });
			const middle = await createTestPost(viewer.id, "b", { createdAt: minutesAgo(20) });
			const newest = await createTestPost(viewer.id, "c", { createdAt: minutesAgo(10) });

			expect((await getHomeFeed(viewer.id)).map((p) => p.id)).toEqual([newest, middle, oldest]);
			expect((await getHomeFeed(viewer.id, { limit: 1, offset: 1 })).map((p) => p.id)).toEqual([
				middle,
			]);
		});

		it("enriches posts with author, counts and the viewer's like state", async () => {
			const viewer = await createTestUser();
			const author = await createTestUser();
			await createTestFollow(viewer.id, author.id);
			const postId = await createTestPost(author.id, "liked post");
			await createTestLike(viewer.id, postId);

			const [post] = await getHomeFeed(viewer.id);
			expect(post).toMatchObject({
				id: postId,
				likeCount: 1,
				commentCount: 0,
				isLiked: true,
				author: { id: author.id, username: author.username },
			});
		});
	});

	describe("getExploreFeed", () => {
		it("returns posts from everyone, newest first", async () => {
			const a = await createTestUser();
			const b = await createTestUser();
			const older = await createTestPost(a.id, "older", { createdAt: minutesAgo(5) });
			const newer = await createTestPost(b.id, "newer", { createdAt: minutesAgo(1) });

			const feed = await getExploreFeed();
			expect(feed.map((p) => p.id)).toEqual([newer, older]);
		});

		it("reports isLiked=false for anonymous viewers", async () => {
			const author = await createTestUser();
			const liker = await createTestUser();
			const postId = await createTestPost(author.id);
			await createTestLike(liker.id, postId);

			const [post] = await getExploreFeed();
			expect(post).toMatchObject({ likeCount: 1, isLiked: false });
		});
	});
});
