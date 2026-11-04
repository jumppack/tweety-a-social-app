import { describe, expect, it } from "vitest";
import { createTestComment, createTestPost, createTestUser } from "../../tests/helpers";
import { listReports } from "./admin.service";
import { createReport } from "./reports.service";

describe("ReportsService.createReport", () => {
	it("files a pending report that admins can see with a preview of the target", async () => {
		const author = await createTestUser();
		const reporter = await createTestUser();
		const postId = await createTestPost(author.id, "Buy cheap followers now");

		const { id } = await createReport(reporter.id, {
			targetType: "post",
			targetId: postId,
			reason: "Spam",
			description: "Link farm",
		});

		const { reports } = await listReports({ statusFilter: "pending", limit: 100 });
		expect(reports.find((r) => r.id === id)).toMatchObject({
			status: "pending",
			reason: "Spam",
			description: "Link farm",
			reporterUsername: reporter.username,
			targetExists: true,
			targetPreview: "Buy cheap followers now",
			targetAuthorUsername: author.username,
		});
	});

	it("reports comments and users", async () => {
		const author = await createTestUser();
		const reporter = await createTestUser();
		const postId = await createTestPost(author.id);
		const commentId = await createTestComment(postId, author.id, "rude reply");

		await expect(
			createReport(reporter.id, {
				targetType: "comment",
				targetId: commentId,
				reason: "Harassment",
			}),
		).resolves.toHaveProperty("id");
		await expect(
			createReport(reporter.id, {
				targetType: "user",
				targetId: author.id,
				reason: "Fake account",
			}),
		).resolves.toHaveProperty("id");
	});

	it("rejects reporting your own content or yourself", async () => {
		const user = await createTestUser();
		const postId = await createTestPost(user.id);
		await expect(
			createReport(user.id, { targetType: "post", targetId: postId, reason: "Spam" }),
		).rejects.toThrow("You cannot report your own post");
		await expect(
			createReport(user.id, { targetType: "user", targetId: user.id, reason: "Spam" }),
		).rejects.toThrow("You cannot report yourself");
	});

	it("rejects a second pending report on the same thing", async () => {
		const author = await createTestUser();
		const reporter = await createTestUser();
		const postId = await createTestPost(author.id);
		const input = { targetType: "post", targetId: postId, reason: "Spam" };

		await createReport(reporter.id, input);
		await expect(createReport(reporter.id, input)).rejects.toThrow("already reported");
	});

	it("validates the target and reason", async () => {
		const reporter = await createTestUser();
		await expect(
			createReport(reporter.id, { targetType: "post", targetId: "missing", reason: "Spam" }),
		).rejects.toThrow("Post not found");
		await expect(
			createReport(reporter.id, { targetType: "planet", targetId: "x", reason: "Spam" }),
		).rejects.toThrow("Invalid report target");
		const author = await createTestUser();
		const postId = await createTestPost(author.id);
		await expect(
			createReport(reporter.id, { targetType: "post", targetId: postId, reason: "  " }),
		).rejects.toThrow("A reason is required");
	});
});
