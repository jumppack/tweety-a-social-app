import { and, desc, eq, gte, inArray, like, or, type SQL, sql } from "drizzle-orm";
import { db, schema } from "../db";
import {
	FailedPreconditionError,
	ForbiddenError,
	NotFoundError,
	ValidationError,
} from "../errors/app-error";
import { generateId } from "./utils";

const { users, posts, comments, reports, auditLogs } = schema;

interface ListUsersOptions {
	limit?: number;
	offset?: number;
	searchQuery?: string;
	roleFilter?: string;
}

interface ListReportsOptions {
	limit?: number;
	offset?: number;
	statusFilter?: string;
	typeFilter?: string;
}

export async function listUsers(options: ListUsersOptions = {}) {
	const limit = options.limit || 20;
	const offset = options.offset || 0;

	let query = db
		.select({
			id: users.id,
			email: users.email,
			username: users.username,
			displayName: users.displayName,
			avatarUrl: users.avatarUrl,
			bio: users.bio,
			role: users.role,
			createdAt: users.createdAt,
			updatedAt: users.updatedAt,
			bannedAt: users.bannedAt,
			bannedReason: users.bannedReason,
		})
		.from(users)
		.$dynamic();

	const conditions: SQL[] = [];
	if (options.searchQuery) {
		const pattern = `%${options.searchQuery}%`;
		conditions.push(
			or(
				like(users.username, pattern),
				like(users.displayName, pattern),
				like(users.email, pattern),
			) as SQL,
		);
	}
	if (options.roleFilter) {
		conditions.push(eq(users.role, options.roleFilter as "user" | "admin" | "moderator"));
	}
	const where = conditions.length ? and(...conditions) : undefined;
	if (where) query = query.where(where);

	const result = await query.orderBy(desc(users.createdAt)).limit(limit).offset(offset);

	// Get post and comment counts
	const usersWithCounts = await Promise.all(
		result.map(async (user) => {
			const postCount = await db
				.select({ count: sql<number>`count(*)` })
				.from(posts)
				.where(eq(posts.authorId, user.id))
				.get();

			const commentCount = await db
				.select({ count: sql<number>`count(*)` })
				.from(comments)
				.where(eq(comments.authorId, user.id))
				.get();

			return {
				...user,
				postCount: postCount?.count || 0,
				commentCount: commentCount?.count || 0,
			};
		}),
	);

	// Total respects the filters so paging matches the list
	const totalResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(users)
		.where(where)
		.get();

	return {
		users: usersWithCounts,
		total: totalResult?.count || 0,
	};
}

export async function getUserDetails(userId: string) {
	const user = await db.select().from(users).where(eq(users.id, userId)).get();

	if (!user) {
		throw new NotFoundError("User not found");
	}

	const postCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(posts)
		.where(eq(posts.authorId, userId))
		.get();

	const commentCount = await db
		.select({ count: sql<number>`count(*)` })
		.from(comments)
		.where(eq(comments.authorId, userId))
		.get();

	const { passwordHash: _, ...userWithoutPassword } = user;

	return {
		...userWithoutPassword,
		postCount: postCount?.count || 0,
		commentCount: commentCount?.count || 0,
	};
}

export async function banUser(userId: string, reason: string, adminId: string) {
	if (userId === adminId) {
		throw new ForbiddenError("You cannot ban yourself");
	}
	if (!reason?.trim()) {
		throw new ValidationError("A ban reason is required");
	}

	const user = await db.select().from(users).where(eq(users.id, userId)).get();

	if (!user) {
		throw new NotFoundError("User not found");
	}

	if (user.role === "admin") {
		throw new ForbiddenError("Cannot ban admin users");
	}

	await db
		.update(users)
		.set({
			bannedAt: new Date(),
			bannedReason: reason,
			bannedBy: adminId,
		})
		.where(eq(users.id, userId));

	// Create audit log
	await createAuditLog(adminId, "ban_user", "user", userId, { reason });

	return { success: true };
}

export async function unbanUser(userId: string, adminId: string) {
	const user = await db.select().from(users).where(eq(users.id, userId)).get();

	if (!user) {
		throw new NotFoundError("User not found");
	}

	await db
		.update(users)
		.set({
			bannedAt: null,
			bannedReason: null,
			bannedBy: null,
		})
		.where(eq(users.id, userId));

	// Create audit log
	await createAuditLog(adminId, "unban_user", "user", userId);

	return { success: true };
}

export async function updateUserRole(userId: string, role: string, adminId: string) {
	const validRoles = ["user", "admin", "moderator"];
	if (!validRoles.includes(role)) {
		throw new ValidationError("Invalid role");
	}

	if (userId === adminId) {
		throw new ForbiddenError("You cannot change your own role");
	}

	const user = await db.select().from(users).where(eq(users.id, userId)).get();

	if (!user) {
		throw new NotFoundError("User not found");
	}

	await db
		.update(users)
		.set({ role: role as "user" | "admin" | "moderator" })
		.where(eq(users.id, userId));

	// Create audit log
	await createAuditLog(adminId, "update_role", "user", userId, {
		oldRole: user.role,
		newRole: role,
	});

	return { success: true };
}

export async function deleteUser(userId: string, adminId: string) {
	const user = await db.select().from(users).where(eq(users.id, userId)).get();

	if (!user) {
		throw new NotFoundError("User not found");
	}

	if (user.role === "admin") {
		throw new ForbiddenError("Cannot delete admin users");
	}

	await db.delete(users).where(eq(users.id, userId));

	// Create audit log
	await createAuditLog(adminId, "delete_user", "user", userId, { username: user.username });

	return { success: true };
}

export async function deletePostAdmin(postId: string, reason: string, adminId: string) {
	const post = await db.select().from(posts).where(eq(posts.id, postId)).get();

	if (!post) {
		throw new NotFoundError("Post not found");
	}

	await db.delete(posts).where(eq(posts.id, postId));

	// Create audit log
	await createAuditLog(adminId, "delete_post", "post", postId, { reason });

	return { success: true };
}

export async function deleteCommentAdmin(commentId: string, reason: string, adminId: string) {
	const comment = await db.select().from(comments).where(eq(comments.id, commentId)).get();

	if (!comment) {
		throw new NotFoundError("Comment not found");
	}

	await db.delete(comments).where(eq(comments.id, commentId));

	// Create audit log
	await createAuditLog(adminId, "delete_comment", "comment", commentId, { reason });

	return { success: true };
}

export async function listReports(options: ListReportsOptions = {}) {
	const limit = options.limit || 20;
	const offset = options.offset || 0;

	let query = db
		.select({
			id: reports.id,
			reporterId: reports.reporterId,
			targetType: reports.targetType,
			targetId: reports.targetId,
			reason: reports.reason,
			description: reports.description,
			status: reports.status,
			reviewedBy: reports.reviewedBy,
			reviewedAt: reports.reviewedAt,
			createdAt: reports.createdAt,
		})
		.from(reports)
		.$dynamic();

	const conditions: SQL[] = [];
	if (options.statusFilter) {
		conditions.push(
			eq(reports.status, options.statusFilter as "pending" | "reviewed" | "actioned" | "dismissed"),
		);
	}
	if (options.typeFilter) {
		conditions.push(eq(reports.targetType, options.typeFilter as "user" | "post" | "comment"));
	}
	const where = conditions.length ? and(...conditions) : undefined;
	if (where) query = query.where(where);

	const result = await query.orderBy(desc(reports.createdAt)).limit(limit).offset(offset);
	const totalResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(reports)
		.where(where)
		.get();

	return {
		reports: await enrichReports(result),
		total: totalResult?.count || 0,
	};
}

type ReportRow = Pick<
	typeof reports.$inferSelect,
	"id" | "reporterId" | "targetType" | "targetId" | "reason" | "description" | "status"
> &
	Partial<typeof reports.$inferSelect>;

/**
 * Adds the reporter's username and a preview of what was reported, with a
 * fixed number of queries however many reports there are.
 */
async function enrichReports<T extends ReportRow>(rows: T[]) {
	const idsOf = (type: string) => rows.filter((r) => r.targetType === type).map((r) => r.targetId);
	const postIds = idsOf("post");
	const commentIds = idsOf("comment");

	const [postRows, commentRows] = await Promise.all([
		postIds.length
			? db
					.select({ id: posts.id, content: posts.content, authorId: posts.authorId })
					.from(posts)
					.where(inArray(posts.id, postIds))
			: [],
		commentIds.length
			? db
					.select({
						id: comments.id,
						content: comments.content,
						authorId: comments.authorId,
						postId: comments.postId,
					})
					.from(comments)
					.where(inArray(comments.id, commentIds))
			: [],
	]);
	const postMap = new Map(postRows.map((p) => [p.id, p]));
	const commentMap = new Map(commentRows.map((c) => [c.id, c]));

	const userIds = new Set<string>();
	for (const r of rows) {
		userIds.add(r.reporterId);
		if (r.targetType === "user") userIds.add(r.targetId);
	}
	for (const p of postRows) userIds.add(p.authorId);
	for (const c of commentRows) userIds.add(c.authorId);
	const userRows = userIds.size
		? await db
				.select({ id: users.id, username: users.username, displayName: users.displayName })
				.from(users)
				.where(inArray(users.id, [...userIds]))
		: [];
	const userMap = new Map(userRows.map((u) => [u.id, u]));

	return rows.map((report) => {
		let target: { preview: string; authorId: string; postId?: string } | undefined;
		if (report.targetType === "post") {
			const post = postMap.get(report.targetId);
			if (post) target = { preview: post.content, authorId: post.authorId, postId: post.id };
		} else if (report.targetType === "comment") {
			const comment = commentMap.get(report.targetId);
			if (comment) {
				target = { preview: comment.content, authorId: comment.authorId, postId: comment.postId };
			}
		} else {
			const user = userMap.get(report.targetId);
			if (user) target = { preview: `${user.displayName} (@${user.username})`, authorId: user.id };
		}

		return {
			...report,
			reporterUsername: userMap.get(report.reporterId)?.username || "Unknown",
			targetExists: !!target,
			targetPreview: target?.preview,
			targetAuthorId: target?.authorId,
			targetAuthorUsername: target ? userMap.get(target.authorId)?.username : undefined,
			targetPostId: target?.postId,
		};
	});
}

export async function getReport(reportId: string) {
	const report = await db.select().from(reports).where(eq(reports.id, reportId)).get();

	if (!report) {
		throw new NotFoundError("Report not found");
	}

	const [enriched] = await enrichReports([report]);
	return enriched;
}

const REVIEW_ACTIONS = ["dismiss", "remove_content", "ban_user"] as const;
type ReviewAction = (typeof REVIEW_ACTIONS)[number];

/**
 * Resolves a report. "remove_content" deletes the reported post or comment and
 * "ban_user" bans whoever posted it (or the reported user); both go through
 * the same functions as the manual admin actions, so they are audited too.
 */
export async function reviewReport(
	reportId: string,
	action: string,
	adminId: string,
	notes?: string,
) {
	if (!REVIEW_ACTIONS.includes(action as ReviewAction)) {
		throw new ValidationError("Invalid review action");
	}

	const report = await db.select().from(reports).where(eq(reports.id, reportId)).get();

	if (!report) {
		throw new NotFoundError("Report not found");
	}
	if (report.status !== "pending") {
		throw new FailedPreconditionError("This report has already been reviewed");
	}

	const [target] = await enrichReports([report]);
	const actionReason = `Report: ${report.reason}${notes?.trim() ? ` (${notes.trim()})` : ""}`;

	if (action === "remove_content") {
		if (report.targetType === "user") {
			throw new ValidationError("A user can't be removed; ban them instead");
		}
		if (target.targetExists) {
			if (report.targetType === "post") {
				await deletePostAdmin(report.targetId, actionReason, adminId);
			} else {
				await deleteCommentAdmin(report.targetId, actionReason, adminId);
			}
		}
	} else if (action === "ban_user") {
		if (!target.targetAuthorId) {
			throw new FailedPreconditionError("The reported content no longer exists");
		}
		const author = await db
			.select({ bannedAt: users.bannedAt })
			.from(users)
			.where(eq(users.id, target.targetAuthorId))
			.get();
		if (!author?.bannedAt) {
			await banUser(target.targetAuthorId, actionReason, adminId);
		}
	}

	const status = action === "dismiss" ? "dismissed" : "actioned";
	// Removing content settles every pending report about it, not just this one
	const scope =
		action === "remove_content"
			? and(
					eq(reports.targetType, report.targetType),
					eq(reports.targetId, report.targetId),
					eq(reports.status, "pending"),
				)
			: eq(reports.id, reportId);

	await db
		.update(reports)
		.set({ status, reviewedBy: adminId, reviewedAt: new Date() })
		.where(scope);

	await createAuditLog(adminId, "review_report", "report", reportId, {
		action,
		notes,
		targetType: report.targetType,
		targetId: report.targetId,
	});

	return { success: true, status };
}

// ----- Content moderation lists -----

const pendingReportCount = (type: "post" | "comment", id: typeof posts.id | typeof comments.id) =>
	sql<number>`(select count(*) from reports where reports.target_type = ${type} and reports.target_id = ${id} and reports.status = 'pending')`;

const postSelection = {
	id: posts.id,
	content: posts.content,
	createdAt: posts.createdAt,
	authorId: posts.authorId,
	authorUsername: users.username,
	authorDisplayName: users.displayName,
	likeCount: sql<number>`(select count(*) from likes where likes.post_id = ${posts.id})`,
	commentCount: sql<number>`(select count(*) from comments where comments.post_id = ${posts.id})`,
	reportCount: pendingReportCount("post", posts.id),
};

const commentSelection = {
	id: comments.id,
	content: comments.content,
	createdAt: comments.createdAt,
	postId: comments.postId,
	postExcerpt: sql<string>`substr(${posts.content}, 1, 60)`,
	authorId: comments.authorId,
	authorUsername: users.username,
	authorDisplayName: users.displayName,
	reportCount: pendingReportCount("comment", comments.id),
};

interface ContentListOptions {
	limit?: number;
	offset?: number;
	searchQuery?: string;
	reportedOnly?: boolean;
}

export async function listPostsAdmin(options: ContentListOptions = {}) {
	const conditions: SQL[] = [];
	if (options.searchQuery?.trim()) {
		const pattern = `%${options.searchQuery.trim()}%`;
		conditions.push(
			or(
				like(posts.content, pattern),
				like(users.username, pattern),
				like(users.displayName, pattern),
			) as SQL,
		);
	}
	if (options.reportedOnly) conditions.push(sql`${pendingReportCount("post", posts.id)} > 0`);
	const where = conditions.length ? and(...conditions) : undefined;

	const rows = await db
		.select(postSelection)
		.from(posts)
		.innerJoin(users, eq(posts.authorId, users.id))
		.where(where)
		.orderBy(desc(posts.createdAt), desc(posts.id))
		.limit(options.limit || 20)
		.offset(options.offset || 0);

	const total = await db
		.select({ count: sql<number>`count(*)` })
		.from(posts)
		.innerJoin(users, eq(posts.authorId, users.id))
		.where(where)
		.get();

	return { posts: rows, total: total?.count || 0 };
}

export async function listCommentsAdmin(options: ContentListOptions = {}) {
	const conditions: SQL[] = [];
	if (options.searchQuery?.trim()) {
		const pattern = `%${options.searchQuery.trim()}%`;
		conditions.push(
			or(
				like(comments.content, pattern),
				like(users.username, pattern),
				like(users.displayName, pattern),
			) as SQL,
		);
	}
	if (options.reportedOnly) conditions.push(sql`${pendingReportCount("comment", comments.id)} > 0`);
	const where = conditions.length ? and(...conditions) : undefined;

	const rows = await db
		.select(commentSelection)
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.innerJoin(posts, eq(comments.postId, posts.id))
		.where(where)
		.orderBy(desc(comments.createdAt), desc(comments.id))
		.limit(options.limit || 20)
		.offset(options.offset || 0);

	const total = await db
		.select({ count: sql<number>`count(*)` })
		.from(comments)
		.innerJoin(users, eq(comments.authorId, users.id))
		.innerJoin(posts, eq(comments.postId, posts.id))
		.where(where)
		.get();

	return { comments: rows, total: total?.count || 0 };
}

/** One post with all its comments and every report filed against it. */
export async function getPostAdmin(postId: string) {
	const post = await db
		.select(postSelection)
		.from(posts)
		.innerJoin(users, eq(posts.authorId, users.id))
		.where(eq(posts.id, postId))
		.get();

	if (!post) {
		throw new NotFoundError("Post not found");
	}

	const [postComments, postReports] = await Promise.all([
		db
			.select(commentSelection)
			.from(comments)
			.innerJoin(users, eq(comments.authorId, users.id))
			.innerJoin(posts, eq(comments.postId, posts.id))
			.where(eq(comments.postId, postId))
			.orderBy(comments.createdAt, comments.id),
		db
			.select()
			.from(reports)
			.where(and(eq(reports.targetType, "post"), eq(reports.targetId, postId)))
			.orderBy(desc(reports.createdAt)),
	]);

	return { post, comments: postComments, reports: await enrichReports(postReports) };
}

export async function getDashboardStats() {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users).get();
	const totalPosts = await db.select({ count: sql<number>`count(*)` }).from(posts).get();
	const totalComments = await db.select({ count: sql<number>`count(*)` }).from(comments).get();

	const pendingReports = await db
		.select({ count: sql<number>`count(*)` })
		.from(reports)
		.where(eq(reports.status, "pending"))
		.get();

	const bannedUsers = await db
		.select({ count: sql<number>`count(*)` })
		.from(users)
		.where(sql`${users.bannedAt} IS NOT NULL`)
		.get();

	const newUsersToday = await db
		.select({ count: sql<number>`count(*)` })
		.from(users)
		.where(gte(users.createdAt, today))
		.get();

	const newPostsToday = await db
		.select({ count: sql<number>`count(*)` })
		.from(posts)
		.where(gte(posts.createdAt, today))
		.get();

	return {
		totalUsers: totalUsers?.count || 0,
		totalPosts: totalPosts?.count || 0,
		totalComments: totalComments?.count || 0,
		pendingReports: pendingReports?.count || 0,
		bannedUsers: bannedUsers?.count || 0,
		newUsersToday: newUsersToday?.count || 0,
		newPostsToday: newPostsToday?.count || 0,
	};
}

export async function getAuditLogs(
	options: { limit?: number; offset?: number; adminIdFilter?: string; actionFilter?: string } = {},
) {
	const limit = options.limit || 50;
	const offset = options.offset || 0;

	// One combined condition: chained .where() calls replace each other
	const conditions: SQL[] = [];
	if (options.adminIdFilter) conditions.push(eq(auditLogs.adminId, options.adminIdFilter));
	if (options.actionFilter) conditions.push(eq(auditLogs.action, options.actionFilter));
	const where = conditions.length ? and(...conditions) : undefined;

	const logs = await db
		.select({
			id: auditLogs.id,
			adminId: auditLogs.adminId,
			adminUsername: sql<string>`coalesce(${users.username}, 'Unknown')`,
			action: auditLogs.action,
			targetType: auditLogs.targetType,
			targetId: auditLogs.targetId,
			details: auditLogs.details,
			ipAddress: auditLogs.ipAddress,
			createdAt: auditLogs.createdAt,
		})
		.from(auditLogs)
		.leftJoin(users, eq(auditLogs.adminId, users.id))
		.where(where)
		.orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
		.limit(limit)
		.offset(offset);

	const totalResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(auditLogs)
		.where(where)
		.get();

	return { logs, total: totalResult?.count || 0 };
}

async function createAuditLog(
	adminId: string,
	action: string,
	targetType?: string,
	targetId?: string,
	details?: Record<string, unknown>,
) {
	await db.insert(auditLogs).values({
		id: generateId(),
		adminId,
		action,
		targetType: targetType as "user" | "post" | "comment" | "report" | undefined,
		targetId,
		details: details ? JSON.stringify(details) : null,
	});
}
