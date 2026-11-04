import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { NotFoundError } from "../errors/app-error";
import { batchEnrichPosts, generateId } from "./utils";

const { bookmarks, posts, users } = schema;

/**
 * Toggle bookmark for a post (create if not exists, delete if exists)
 */
export async function toggleBookmark(postId: string, userId: string) {
	// Verify post exists
	const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

	if (!post) {
		throw new NotFoundError("Post not found");
	}

	// Check if already bookmarked
	const existingBookmark = await db
		.select()
		.from(bookmarks)
		.where(and(eq(bookmarks.postId, postId), eq(bookmarks.userId, userId)))
		.get();

	if (existingBookmark) {
		// Remove bookmark
		await db.delete(bookmarks).where(eq(bookmarks.id, existingBookmark.id));
		return { bookmarked: false };
	} else {
		// Add bookmark
		await db.insert(bookmarks).values({
			id: generateId(),
			postId,
			userId,
		});
		return { bookmarked: true };
	}
}

/**
 * Get bookmark status for a single post
 */
export async function getBookmarkStatus(postId: string, userId: string) {
	const bookmark = await db
		.select()
		.from(bookmarks)
		.where(and(eq(bookmarks.postId, postId), eq(bookmarks.userId, userId)))
		.get();

	return { bookmarked: !!bookmark };
}

/**
 * Get all bookmarked posts for a user with pagination.
 * Reduces 41 queries for 10 bookmarks down to 4 queries using JOINs and batched enrichment.
 */
export async function getBookmarkedPosts(
	userId: string,
	requesterId?: string,
	limit = 20,
	offset = 0,
) {
	const bookmarkedPostsWithDetails = await db
		.select({
			id: posts.id,
			content: posts.content,
			createdAt: posts.createdAt,
			updatedAt: posts.updatedAt,
			author: {
				id: users.id,
				username: users.username,
				displayName: users.displayName,
				avatarUrl: users.avatarUrl,
			},
		})
		.from(bookmarks)
		.innerJoin(posts, eq(bookmarks.postId, posts.id))
		.leftJoin(users, eq(posts.authorId, users.id))
		.where(eq(bookmarks.userId, userId))
		.orderBy(desc(bookmarks.createdAt))
		.limit(limit)
		.offset(offset);

	if (bookmarkedPostsWithDetails.length === 0) {
		return [];
	}

	return batchEnrichPosts(bookmarkedPostsWithDetails, requesterId);
}
