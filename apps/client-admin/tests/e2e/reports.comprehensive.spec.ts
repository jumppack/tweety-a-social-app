import { expect, test } from "@playwright/test";
import { createReport, registerUser } from "./fixtures/content-helpers";
import {
	apiSession,
	commentIds,
	deletePostAsAuthor,
	getReportStatus,
	getUserBannedAt,
	openReports,
	postExists,
	reportCard,
	reviewFromCard,
	reviewReportViaApi,
	seedReport,
	statusTab,
	switchTab,
	tabCount,
} from "./fixtures/report-helpers";
import { loginAsAdmin } from "./fixtures/test-helpers";

test.describe("Reports Management - Comprehensive", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test.describe("Tabs and filters", () => {
		test("switching tabs updates the URL and survives a reload", async ({ page }) => {
			await openReports(page);
			await switchTab(page, "Resolved");
			await expect(page).toHaveURL(/status=actioned/);

			await page.reload({ waitUntil: "networkidle" });
			await expect(statusTab(page, "Resolved")).toHaveAttribute("aria-selected", "true");
			await expect(statusTab(page, "Pending")).toHaveAttribute("aria-selected", "false");

			await switchTab(page, "Pending");
			await expect(page).not.toHaveURL(/status=/);
		});

		test("only reports with the selected status are listed", async ({ page }) => {
			const seeded = await seedReport("post");
			await reviewReportViaApi(seeded.report.id, "dismiss");
			await openReports(page);

			await expect(reportCard(page, seeded)).toHaveCount(0);
			await switchTab(page, "Resolved");
			await expect(reportCard(page, seeded)).toHaveCount(0);
			await switchTab(page, "Dismissed");
			await expect(reportCard(page, seeded)).toBeVisible();
			await switchTab(page, "All");
			await expect(reportCard(page, seeded)).toBeVisible();
		});

		test("type filter narrows the list and the counts", async ({ page }) => {
			const postReport = await seedReport("post");
			const userReport = await seedReport("user");
			await openReports(page);
			const allPending = await tabCount(page, "Pending");

			await page.getByLabel("Filter by type").selectOption("user");
			await expect(page).toHaveURL(/type=user/);
			await expect(reportCard(page, userReport)).toBeVisible();
			await expect(reportCard(page, postReport)).toHaveCount(0);
			const userPending = await tabCount(page, "Pending");
			expect(userPending).toBeGreaterThanOrEqual(1);
			expect(userPending).toBeLessThanOrEqual(allPending + 5);
			for (const badge of await page.locator("article").all()) {
				await expect(badge.getByText("user", { exact: true })).toBeVisible();
			}

			await page.getByLabel("Filter by type").selectOption("");
			await expect(reportCard(page, postReport)).toBeVisible();
		});
	});

	test.describe("Report cards by target type", () => {
		test("comment report links to the parent post and the author", async ({ page }) => {
			const seeded = await seedReport("comment", "Harassment or bullying");
			await openReports(page, "?type=comment");

			const card = reportCard(page, seeded);
			await expect(card.getByText("comment", { exact: true })).toBeVisible();
			await expect(card.getByText(seeded.comment.content)).toBeVisible();
			await expect(card.getByText("Harassment or bullying")).toBeVisible();
			await expect(card.getByRole("link", { name: "View comment on post" })).toHaveAttribute(
				"href",
				`/posts/${seeded.post.id}`,
			);
			await expect(card.getByRole("link", { name: `@${seeded.author.username}` })).toHaveAttribute(
				"href",
				`/users/${seeded.author.id}`,
			);
			await expect(card.getByRole("button", { name: /^Remove comment reported by/ })).toBeVisible();
			await expect(card.getByRole("button", { name: /^Ban @/ })).toHaveText("Ban author");
		});

		test("user report shows the user and links to their profile", async ({ page }) => {
			const seeded = await seedReport("user", "Fake account or bot");
			await openReports(page, "?type=user");

			const card = reportCard(page, seeded);
			await expect(card.getByText("user", { exact: true })).toBeVisible();
			await expect(card.getByText(seeded.preview)).toBeVisible();
			await expect(card.getByRole("link", { name: "View user" })).toHaveAttribute(
				"href",
				`/users/${seeded.author.id}`,
			);
			// Users can be banned, not "removed"
			await expect(card.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
			await expect(card.getByRole("button", { name: /^Ban @/ })).toHaveText("Ban user");

			await card.getByRole("link", { name: "View user" }).click();
			await expect(page).toHaveURL(`/users/${seeded.author.id}`);
			await expect(page.getByText(`@${seeded.author.username}`).first()).toBeVisible();
		});

		test("a report whose post was already deleted shows the deleted state", async ({ page }) => {
			const seeded = await seedReport("post");
			await deletePostAsAuthor(seeded.author, seeded.post.id);
			await openReports(page);

			const card = reportCard(page, seeded);
			await expect(card.getByText("Content was deleted")).toBeVisible();
			await expect(card.getByText(seeded.preview)).toHaveCount(0);
			await expect(card.getByRole("link", { name: /^View/ })).toHaveCount(0);
			await expect(card.getByRole("button", { name: /^Ban/ })).toHaveCount(0);

			// It can still be settled: "Mark resolved" resolves without deleting anything
			await reviewFromCard(page, card, /resolved$/, /^Mark resolved$/);
			await expect(card).toHaveCount(0);
			expect(await getReportStatus(seeded.report.id)).toBe("actioned");
		});
	});

	test.describe("Review actions", () => {
		test("cancelling the dialog leaves the report pending", async ({ page }) => {
			const seeded = await seedReport("post");
			await openReports(page);
			const card = reportCard(page, seeded);

			await card.getByRole("button", { name: /^Dismiss report/ }).click();
			const dialog = page.getByRole("dialog");
			await expect(dialog).toContainText("Dismiss this report?");
			await dialog.getByRole("button", { name: "Cancel" }).click();
			await expect(dialog).toBeHidden();

			await card.getByRole("button", { name: /^Ban @/ }).click();
			await page.keyboard.press("Escape");
			await expect(dialog).toBeHidden();

			await expect(card.getByTestId("report-status")).toHaveText("Pending");
			expect(await getReportStatus(seeded.report.id)).toBe("pending");
		});

		test("Remove content deletes the post and resolves every report on it", async ({ page }) => {
			const seeded = await seedReport("post");
			// A second, independent report on the same post
			const otherReporter = await registerUser("reporter");
			const second = await createReport(otherReporter, "post", seeded.post.id, "Spam", "dup");
			await openReports(page);
			const resolvedBefore = await tabCount(page, "Resolved");

			const card = reportCard(page, seeded);
			const dialog = await reviewFromCard(
				page,
				card,
				/^Remove post reported by/,
				/^Remove post$/,
				"Clear spam",
			);
			await expect(dialog).toBeHidden();
			await expect(page.getByText("Content removed and report resolved.")).toBeVisible();
			await expect(card).toHaveCount(0);
			expect(await tabCount(page, "Resolved")).toBeGreaterThanOrEqual(resolvedBefore + 2);

			expect(await postExists(seeded.post.id)).toBe(false);
			expect(await getReportStatus(second.id)).toBe("actioned");

			await switchTab(page, "Resolved");
			await expect(card.getByTestId("report-status")).toHaveText("Resolved");
			await expect(card.getByText("Content was deleted")).toBeVisible();
			await expect(card.getByText(/^Resolved (just now|\d+m ago)$/)).toBeVisible();
		});

		test("Remove content on a comment deletes only the comment", async ({ page }) => {
			const seeded = await seedReport("comment");
			await openReports(page, "?type=comment");

			const card = reportCard(page, seeded);
			await reviewFromCard(page, card, /^Remove comment reported by/, /^Remove comment$/);
			await expect(card).toHaveCount(0);

			expect(await commentIds(seeded.post.id)).not.toContain(seeded.comment.id);
			expect(await postExists(seeded.post.id)).toBe(true);
		});

		test("Ban author bans whoever wrote the reported post", async ({ page }) => {
			const seeded = await seedReport("post");
			await openReports(page);

			const card = reportCard(page, seeded);
			const dialog = await reviewFromCard(
				page,
				card,
				new RegExp(`^Ban @${seeded.author.username}`),
				/^Confirm ban$/,
				"Repeat spammer",
			);
			await expect(dialog).toBeHidden();
			await expect(page.getByText("User banned and report resolved.")).toBeVisible();
			await expect(card).toHaveCount(0);

			expect(await getUserBannedAt(seeded.author.id)).not.toBeNull();
			// The post itself is left alone
			expect(await postExists(seeded.post.id)).toBe(true);

			await page.goto(`/users/${seeded.author.id}`, { waitUntil: "networkidle" });
			await expect(page.getByText("banned", { exact: true })).toBeVisible();
		});

		test("Ban user on a user report bans the reported user", async ({ page }) => {
			const seeded = await seedReport("user");
			await openReports(page, "?type=user");

			const card = reportCard(page, seeded);
			await reviewFromCard(page, card, /^Ban @/, /^Confirm ban$/);
			await expect(card).toHaveCount(0);
			expect(await getUserBannedAt(seeded.author.id)).not.toBeNull();
			expect(await getReportStatus(seeded.report.id)).toBe("actioned");
		});

		test("you cannot ban yourself from a report about your own account", async ({ page }) => {
			const { userId: adminId } = await apiSession("admin");
			const seeded = { description: `E2E report self ${Date.now().toString(36)}` };
			const reporter = await registerUser("reporter");
			const report = await createReport(reporter, "user", adminId, "Spam", seeded.description);
			await openReports(page, "?type=user");

			const card = reportCard(page, seeded);
			const ban = card.getByRole("button", { name: /^Ban @admin/ });
			await expect(ban).toBeDisabled();
			await expect(ban).toHaveAttribute("title", "You cannot ban yourself");

			// Settle it so it doesn't linger in Pending
			await reviewFromCard(page, card, /^Dismiss report/, /^Dismiss report$/);
			await expect(card).toHaveCount(0);
			expect(await getReportStatus(report.id)).toBe("dismissed");
		});

		test("shows the API error inline when the ban is rejected", async ({ browser }) => {
			// A moderator trying to ban an admin: the API refuses, nothing changes
			const { userId: adminId } = await apiSession("admin");
			const seeded = { description: `E2E report admin ${Date.now().toString(36)}` };
			const reporter = await registerUser("reporter");
			const report = await createReport(reporter, "user", adminId, "Spam", seeded.description);

			const page = await browser.newPage();
			await loginAsAdmin(page, "moderator");
			await openReports(page, "?type=user");

			const card = reportCard(page, seeded);
			await card.getByRole("button", { name: /^Ban @admin/ }).click();
			const dialog = page.getByRole("dialog");
			await dialog.getByRole("button", { name: "Confirm ban" }).click();
			await expect(dialog.getByRole("alert")).toHaveText("Cannot ban admin users");
			await expect(dialog.getByRole("button", { name: "Confirm ban" })).toBeEnabled();
			expect(await getReportStatus(report.id)).toBe("pending");
			expect(await getUserBannedAt(adminId)).toBeNull();

			await dialog.getByRole("button", { name: "Cancel" }).click();
			await reviewFromCard(page, card, /^Dismiss report/, /^Dismiss report$/);
			await expect(card).toHaveCount(0);
			await page.close();
		});

		test("reviewing a report someone else just reviewed shows the error", async ({ page }) => {
			const seeded = await seedReport("post");
			await openReports(page);
			const card = reportCard(page, seeded);
			await expect(card).toBeVisible();

			// Another moderator gets there first
			await reviewReportViaApi(seeded.report.id, "dismiss");

			await card.getByRole("button", { name: /^Remove post reported by/ }).click();
			const dialog = page.getByRole("dialog");
			await dialog.getByRole("button", { name: /^Remove post$/ }).click();
			await expect(dialog.getByRole("alert")).toHaveText("This report has already been reviewed");
			expect(await postExists(seeded.post.id)).toBe(true);

			await dialog.getByRole("button", { name: "Cancel" }).click();
			await page.reload({ waitUntil: "networkidle" });
			await expect(page.getByText("Loading reports…")).toBeHidden();
			await expect(reportCard(page, seeded)).toHaveCount(0);
		});
	});

	test.describe("Moderator access", () => {
		test("a moderator can review reports", async ({ browser }) => {
			const page = await browser.newPage();
			await loginAsAdmin(page, "moderator");
			const seeded = await seedReport("comment");
			await openReports(page);

			const card = reportCard(page, seeded);
			await reviewFromCard(page, card, /^Dismiss report/, /^Dismiss report$/);
			await expect(card).toHaveCount(0);
			expect(await getReportStatus(seeded.report.id)).toBe("dismissed");
			expect(await commentIds(seeded.post.id)).toContain(seeded.comment.id);
			await page.close();
		});
	});
});
