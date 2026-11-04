import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTestBookmark,
	createTestComment,
	createTestFollow,
	createTestLike,
	createTestPost,
	createTestUser,
} from "../../tests/helpers";
import { client } from "../db";
import { getBookmarkedPosts } from "./bookmarks.service";
import { getHomeFeed } from "./feed.service";
import { getUserPosts } from "./posts.service";
import { getUser } from "./users.service";

/**
 * N+1 regression guard.
 *
 * Counts every SQL statement the libsql client executes while a page loads, and
 * asserts that the count does not grow with the number of posts. If someone
 * reintroduces a per-post query (e.g. a count inside `posts.map(...)`), the
 * 10-post count exceeds the 3-post count and these tests fail.
 *
 * Budgets are the query counts after batching was introduced.
 */

let queryCount = 0;

beforeEach(() => {
	const original = client.execute.bind(client);
	vi.spyOn(client, "execute").mockImplementation(((...args: Parameters<typeof client.execute>) => {
		queryCount++;
		return original(...args);
	}) as typeof client.execute);
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function countQueries(fn: () => Promise<unknown>): Promise<number> {
	queryCount = 0;
	await fn();
	return queryCount;
}

/** Seeds `n` posts by `author`, each with a like and a comment from `other`. */
async function seedPosts(authorId: string, otherId: string, n: number): Promise<string[]> {
	const ids: string[] = [];
	for (let i = 0; i < n; i++) {
		const postId = await createTestPost(authorId, `Post ${i}`);
		await createTestLike(otherId, postId);
		await createTestComment(postId, otherId, `Comment ${i}`);
		ids.push(postId);
	}
	return ids;
}

describe("query counts do not scale with page size (N+1 guard)", () => {
	it("home feed: constant query count, at most 5", async () => {
		const viewer = await createTestUser();
		const small = await createTestUser();
		const large = await createTestUser();
		await seedPosts(small.id, viewer.id, 3);

		await createTestFollow(viewer.id, small.id);
		const withThree = await countQueries(() => getHomeFeed(viewer.id, { limit: 10 }));

		await seedPosts(large.id, viewer.id, 7);
		await createTestFollow(viewer.id, large.id);
		const withTen = await countQueries(() => getHomeFeed(viewer.id, { limit: 10 }));

		expect(withTen).toBe(withThree);
		expect(withTen).toBeLessThanOrEqual(5);
	});

	// getUser = 5 metadata queries, getUserPosts = 2 + 3 batched enrichment queries
	it("profile page (getUser + getUserPosts): constant query count, at most 10", async () => {
		const viewer = await createTestUser();
		const author = await createTestUser();
		await seedPosts(author.id, viewer.id, 3);

		const loadProfile = async () => {
			await getUser(author.username, viewer.id);
			await getUserPosts(author.username, viewer.id);
		};
		const withThree = await countQueries(loadProfile);

		await seedPosts(author.id, viewer.id, 7);
		const withTen = await countQueries(loadProfile);

		expect(withTen).toBe(withThree);
		expect(withTen).toBeLessThanOrEqual(10);
	});

	it("bookmarks page: constant query count, at most 4", async () => {
		const viewer = await createTestUser();
		const author = await createTestUser();

		const first = await seedPosts(author.id, viewer.id, 3);
		for (const id of first) await createTestBookmark(viewer.id, id);
		const withThree = await countQueries(() => getBookmarkedPosts(viewer.id, viewer.id));

		const more = await seedPosts(author.id, viewer.id, 7);
		for (const id of more) await createTestBookmark(viewer.id, id);
		const withTen = await countQueries(() => getBookmarkedPosts(viewer.id, viewer.id));

		expect(withTen).toBe(withThree);
		expect(withTen).toBeLessThanOrEqual(4);
	});
});
