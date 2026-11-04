import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestComment, createTestPost, createTestUser } from "../../tests/helpers";
import { db, schema } from "../db";
import {
	banUser,
	getAuditLogs,
	getPostAdmin,
	listCommentsAdmin,
	listPostsAdmin,
	listReports,
	listUsers,
	reviewReport,
	unbanUser,
	updateUserRole,
} from "./admin.service";
import { createReport } from "./reports.service";

const { users, posts, comments, reports } = schema;

const getUser = (id: string) => db.select().from(users).where(eq(users.id, id)).get();

describe("AdminService user management guards", () => {
	describe("banUser", () => {
		it("bans a user and records who did it and why", async () => {
			const admin = await createTestUser({ role: "admin" });
			const target = await createTestUser();

			await banUser(target.id, "Spam", admin.id);

			const banned = await getUser(target.id);
			expect(banned?.bannedAt).toBeInstanceOf(Date);
			expect(banned).toMatchObject({ bannedReason: "Spam", bannedBy: admin.id });
		});

		it("refuses to ban yourself", async () => {
			const mod = await createTestUser({ role: "moderator" });
			await expect(banUser(mod.id, "oops", mod.id)).rejects.toThrow("You cannot ban yourself");
		});

		it("requires a reason", async () => {
			const admin = await createTestUser({ role: "admin" });
			const target = await createTestUser();
			await expect(banUser(target.id, "   ", admin.id)).rejects.toThrow("A ban reason is required");
			expect((await getUser(target.id))?.bannedAt).toBeNull();
		});

		it("refuses to ban admins", async () => {
			const mod = await createTestUser({ role: "moderator" });
			const admin = await createTestUser({ role: "admin" });
			await expect(banUser(admin.id, "nope", mod.id)).rejects.toThrow("Cannot ban admin users");
		});

		it("unban clears the ban", async () => {
			const admin = await createTestUser({ role: "admin" });
			const target = await createTestUser();
			await banUser(target.id, "Spam", admin.id);

			await unbanUser(target.id, admin.id);

			expect(await getUser(target.id)).toMatchObject({
				bannedAt: null,
				bannedReason: null,
				bannedBy: null,
			});
		});
	});

	describe("updateUserRole", () => {
		it("changes another user's role", async () => {
			const admin = await createTestUser({ role: "admin" });
			const target = await createTestUser();

			await updateUserRole(target.id, "moderator", admin.id);

			expect((await getUser(target.id))?.role).toBe("moderator");
		});

		it("refuses to change your own role", async () => {
			const admin = await createTestUser({ role: "admin" });
			await expect(updateUserRole(admin.id, "user", admin.id)).rejects.toThrow(
				"You cannot change your own role",
			);
			expect((await getUser(admin.id))?.role).toBe("admin");
		});
	});
});

describe("AdminService report review", () => {
	async function setup(targetType: "post" | "comment" = "post") {
		const admin = await createTestUser({ role: "admin" });
		const author = await createTestUser();
		const reporter = await createTestUser();
		const otherReporter = await createTestUser();
		const postId = await createTestPost(author.id, "reported content");
		const targetId =
			targetType === "post" ? postId : await createTestComment(postId, author.id, "bad comment");
		const { id } = await createReport(reporter.id, { targetType, targetId, reason: "Spam" });
		const { id: otherId } = await createReport(otherReporter.id, {
			targetType,
			targetId,
			reason: "Harassment",
		});
		return { admin, author, postId, targetId, reportId: id, otherReportId: otherId };
	}
	const getReportRow = (id: string) => db.select().from(reports).where(eq(reports.id, id)).get();

	it("dismiss leaves the content alone", async () => {
		const { admin, postId, reportId, otherReportId } = await setup();
		await reviewReport(reportId, "dismiss", admin.id);

		expect(await getReportRow(reportId)).toMatchObject({
			status: "dismissed",
			reviewedBy: admin.id,
		});
		expect((await getReportRow(otherReportId))?.status).toBe("pending");
		expect(await db.select().from(posts).where(eq(posts.id, postId)).get()).toBeDefined();
	});

	it("remove_content deletes a reported post and settles every report on it", async () => {
		const { admin, postId, reportId, otherReportId } = await setup();
		await reviewReport(reportId, "remove_content", admin.id);

		expect(await db.select().from(posts).where(eq(posts.id, postId)).get()).toBeUndefined();
		expect((await getReportRow(reportId))?.status).toBe("actioned");
		expect((await getReportRow(otherReportId))?.status).toBe("actioned");
	});

	it("remove_content deletes a reported comment", async () => {
		const { admin, targetId, reportId } = await setup("comment");
		await reviewReport(reportId, "remove_content", admin.id);
		expect(await db.select().from(comments).where(eq(comments.id, targetId)).get()).toBeUndefined();
	});

	it("ban_user bans the author", async () => {
		const { admin, author, reportId } = await setup();
		await reviewReport(reportId, "ban_user", admin.id, "repeat offender");

		const banned = await getUser(author.id);
		expect(banned?.bannedAt).toBeInstanceOf(Date);
		expect(banned?.bannedReason).toBe("Report: Spam (repeat offender)");
		expect((await getReportRow(reportId))?.status).toBe("actioned");
	});

	it("refuses to review a report twice or with an unknown action", async () => {
		const { admin, reportId } = await setup();
		await expect(reviewReport(reportId, "warn", admin.id)).rejects.toThrow("Invalid review action");
		await reviewReport(reportId, "dismiss", admin.id);
		await expect(reviewReport(reportId, "dismiss", admin.id)).rejects.toThrow(
			"already been reviewed",
		);
	});

	it("applies status and type filters together", async () => {
		const { admin, reportId } = await setup("comment");
		await setup("post");
		const { reports: pendingComments } = await listReports({
			statusFilter: "pending",
			typeFilter: "comment",
			limit: 500,
		});
		expect(pendingComments.every((r) => r.status === "pending" && r.targetType === "comment")).toBe(
			true,
		);
		await reviewReport(reportId, "dismiss", admin.id);
		const { reports: after } = await listReports({
			statusFilter: "pending",
			typeFilter: "comment",
			limit: 500,
		});
		expect(after.some((r) => r.id === reportId)).toBe(false);
	});
});

describe("AdminService content lists", () => {
	it("lists posts with counts, search and a reported-only filter", async () => {
		const author = await createTestUser();
		const reporter = await createTestUser();
		const tag = `needle${Date.now()}`;
		const reported = await createTestPost(author.id, `${tag} reported`);
		await createTestPost(author.id, `${tag} clean`);
		await createTestComment(reported, reporter.id);
		await createReport(reporter.id, { targetType: "post", targetId: reported, reason: "Spam" });

		const all = await listPostsAdmin({ searchQuery: tag });
		expect(all.total).toBe(2);
		expect(all.posts.find((p) => p.id === reported)).toMatchObject({
			authorUsername: author.username,
			commentCount: 1,
			reportCount: 1,
		});

		const flagged = await listPostsAdmin({ searchQuery: tag, reportedOnly: true });
		expect(flagged.posts.map((p) => p.id)).toEqual([reported]);
		expect(flagged.total).toBe(1);
	});

	it("lists comments with the parent post excerpt", async () => {
		const author = await createTestUser();
		const tag = `cneedle${Date.now()}`;
		const postId = await createTestPost(author.id, "Parent post body");
		await createTestComment(postId, author.id, `${tag} hello`);

		const { comments: rows, total } = await listCommentsAdmin({ searchQuery: tag });
		expect(total).toBe(1);
		expect(rows[0]).toMatchObject({ postId, postExcerpt: "Parent post body", reportCount: 0 });
	});

	it("returns a post with its comments and reports", async () => {
		const author = await createTestUser();
		const reporter = await createTestUser();
		const postId = await createTestPost(author.id, "detail post");
		await createTestComment(postId, reporter.id, "first");
		await createReport(reporter.id, { targetType: "post", targetId: postId, reason: "Spam" });

		const detail = await getPostAdmin(postId);
		expect(detail.post).toMatchObject({ id: postId, commentCount: 1, reportCount: 1 });
		expect(detail.comments.map((c) => c.content)).toEqual(["first"]);
		expect(detail.reports[0]).toMatchObject({
			reason: "Spam",
			reporterUsername: reporter.username,
		});
		await expect(getPostAdmin("missing")).rejects.toThrow("Post not found");
	});
});

describe("AdminService list filters", () => {
	it("combines search with the role filter and counts only matches", async () => {
		const tag = `flt${Date.now()}`;
		await createTestUser({ username: `${tag}_u`, role: "user" });
		await createTestUser({ username: `${tag}_m`, role: "moderator" });

		const result = await listUsers({ searchQuery: tag, roleFilter: "moderator" });
		expect(result.users.map((u) => u.username)).toEqual([`${tag}_m`]);
		expect(result.total).toBe(1);
	});

	it("combines admin and action filters on the audit log", async () => {
		const admin = await createTestUser({ role: "admin" });
		const other = await createTestUser({ role: "admin" });
		const target = await createTestUser();
		await banUser(target.id, "Spam", admin.id);
		await unbanUser(target.id, admin.id);
		await banUser(target.id, "Spam again", other.id);

		const result = await getAuditLogs({ adminIdFilter: admin.id, actionFilter: "ban_user" });
		expect(result.total).toBe(1);
		expect(result.logs[0]).toMatchObject({ action: "ban_user", adminUsername: admin.username });
	});
});
