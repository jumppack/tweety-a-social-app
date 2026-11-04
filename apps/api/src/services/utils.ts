import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Async scrypt runs on the libuv threadpool instead of blocking the event loop (scryptSync
// would stall every in-flight gRPC request for ~50ms per login/registration).
const scryptAsync = promisify(scrypt) as (
	password: string,
	salt: string,
	keylen: number,
) => Promise<Buffer>;

const SCRYPT_PREFIX = "scrypt$";

/**
 * Generate a simple ID
 */
export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Hash password using scrypt with a 16-byte random salt.
 */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString("hex");
	const derivedKey = (await scryptAsync(password, salt, 64)).toString("hex");
	return `${SCRYPT_PREFIX}${salt}$${derivedKey}`;
}

export interface VerifyPasswordResult {
	valid: boolean;
	isLegacy: boolean;
}

/**
 * Verify password against hash with support for legacy SHA-256 hashes.
 */
export async function verifyPasswordDetails(
	password: string,
	hashedPassword: string,
): Promise<VerifyPasswordResult> {
	if (hashedPassword.startsWith(SCRYPT_PREFIX)) {
		const parts = hashedPassword.split("$");
		if (parts.length !== 3) return { valid: false, isLegacy: false };
		const [, salt, storedKeyHex] = parts;
		const derivedKey = await scryptAsync(password, salt, 64);
		const storedKey = Buffer.from(storedKeyHex, "hex");
		const valid = storedKey.length === derivedKey.length && timingSafeEqual(derivedKey, storedKey);
		return { valid, isLegacy: false };
	}

	// Legacy SHA-256 fallback (for seeded / legacy users)
	const legacyHash = createHash("sha256")
		.update(password + "salt")
		.digest("hex");
	// Constant-time comparison: `===` short-circuits on the first differing character (timing oracle).
	const legacyBuf = Buffer.from(legacyHash, "utf8");
	const storedBuf = Buffer.from(hashedPassword, "utf8");
	const valid = legacyBuf.length === storedBuf.length && timingSafeEqual(legacyBuf, storedBuf);
	return { valid, isLegacy: valid };
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
	const result = await verifyPasswordDetails(password, hashedPassword);
	return result.valid;
}

/**
 * Convert Date to protobuf Timestamp
 */
export function toProtoTimestamp(date: Date): { seconds: bigint; nanos: number } {
	const ms = date.getTime();
	return {
		seconds: BigInt(Math.floor(ms / 1000)),
		nanos: (ms % 1000) * 1000000,
	};
}

/**
 * Convert protobuf Timestamp to Date
 */
export function fromProtoTimestamp(timestamp: { seconds: bigint; nanos: number }): Date {
	return new Date(Number(timestamp.seconds) * 1000 + timestamp.nanos / 1000000);
}

export interface PostWithAuthor {
	id: string;
	content: string;
	createdAt: Date;
	updatedAt: Date;
	author: {
		id: string;
		username: string;
		displayName: string;
		avatarUrl?: string | null;
	} | null;
}

/**
 * Batch enriches a list of posts with like counts, comment counts, and isLiked status in 3 queries.
 * Eliminates N+1 query anti-patterns across feeds, bookmarks, and user posts.
 */
export async function batchEnrichPosts<T extends PostWithAuthor>(
	postList: T[],
	currentUserId?: string,
) {
	if (!postList || postList.length === 0) {
		return [];
	}

	const { db, schema } = await import("../db");
	const { and, eq, inArray, sql } = await import("drizzle-orm");
	const { likes, comments } = schema;

	const postIds = postList.map((p) => p.id);

	// 1. Batch query like counts (1 query)
	const likeCounts = await db
		.select({
			postId: likes.postId,
			count: sql<number>`count(*)`,
		})
		.from(likes)
		.where(inArray(likes.postId, postIds))
		.groupBy(likes.postId);

	// 2. Batch query comment counts (1 query)
	const commentCounts = await db
		.select({
			postId: comments.postId,
			count: sql<number>`count(*)`,
		})
		.from(comments)
		.where(inArray(comments.postId, postIds))
		.groupBy(comments.postId);

	// 3. Batch query user like status (1 query if currentUserId provided)
	let userLikedPostIds = new Set<string>();
	if (currentUserId) {
		const userLikes = await db
			.select({ postId: likes.postId })
			.from(likes)
			.where(and(eq(likes.userId, currentUserId), inArray(likes.postId, postIds)));
		userLikedPostIds = new Set(
			userLikes.map((l) => l.postId).filter((id): id is string => id !== null),
		);
	}

	const likeMap = new Map(
		likeCounts
			.map((l) => [l.postId, Number(l.count)])
			.filter((entry): entry is [string, number] => entry[0] !== null),
	);
	const commentMap = new Map(
		commentCounts
			.map((c) => [c.postId, Number(c.count)])
			.filter((entry): entry is [string, number] => entry[0] !== null),
	);

	return postList.map((post) => ({
		...post,
		likeCount: likeMap.get(post.id) || 0,
		commentCount: commentMap.get(post.id) || 0,
		isLiked: userLikedPostIds.has(post.id),
	}));
}
