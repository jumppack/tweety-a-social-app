import { db, schema } from "../src/db";
import { generateId, hashPassword } from "../src/services/utils";

const { users, posts, comments, likes, follows, bookmarks, notifications } = schema;

export interface TestUser {
	id: string;
	email: string;
	username: string;
	displayName: string;
	role: "user" | "admin" | "moderator";
}

export async function createTestUser(
	overrides: Partial<{
		email: string;
		username: string;
		displayName: string;
		password: string;
		role: "user" | "admin" | "moderator";
		bio: string;
	}> = {},
): Promise<TestUser> {
	const id = generateId();
	const email = overrides.email || `test-${id}@example.com`;
	const username = overrides.username || `user-${id}`;
	const displayName = overrides.displayName || `Test User ${id}`;
	const password = overrides.password || "password123";
	const role = overrides.role || "user";
	const bio = overrides.bio || null;

	const passwordHash = await hashPassword(password);

	await db.insert(users).values({
		id,
		email,
		username,
		displayName,
		bio,
		passwordHash,
		role,
	});

	return { id, email, username, displayName, role };
}

export async function createTestPost(
	authorId: string,
	content = "Test post content",
	// created_at has 1-second resolution, so tests asserting order must set it explicitly
	options: { createdAt?: Date } = {},
): Promise<string> {
	const id = generateId();
	await db.insert(posts).values({
		id,
		content,
		authorId,
		...(options.createdAt && { createdAt: options.createdAt, updatedAt: options.createdAt }),
	});
	return id;
}

export async function createTestComment(
	postId: string,
	authorId: string,
	content = "Test comment",
): Promise<string> {
	const id = generateId();
	await db.insert(comments).values({
		id,
		content,
		postId,
		authorId,
	});
	return id;
}

export async function createTestLike(userId: string, postId: string): Promise<string> {
	const id = generateId();
	await db.insert(likes).values({
		id,
		userId,
		postId,
	});
	return id;
}

export async function createTestFollow(followerId: string, followingId: string): Promise<string> {
	const id = generateId();
	await db.insert(follows).values({
		id,
		followerId,
		followingId,
	});
	return id;
}

export async function createTestBookmark(userId: string, postId: string): Promise<string> {
	const id = generateId();
	await db.insert(bookmarks).values({
		id,
		userId,
		postId,
	});
	return id;
}

export async function createTestNotification(
	userId: string,
	actorId: string,
	type: string = "like",
	postId?: string,
): Promise<string> {
	const id = generateId();
	await db.insert(notifications).values({
		id,
		userId,
		actorId,
		type,
		postId,
		read: false,
	});
	return id;
}
