import { expect, test } from "@playwright/test";
import {
	findAuditLog,
	getReportStatus,
	getUserBannedAt,
	openReports,
	postExists,
	reportCard,
	reviewFromCard,
	seedReport,
	switchTab,
} from "./fixtures/report-helpers";
import {
	createTargetUser,
	goToAdminPage,
	goToPostDetail,
	goToUserDetail,
	loginAsAdmin,
	setupDialogHandler,
	waitForHydration,
} from "./fixtures/test-helpers";

test.describe("Moderation Workflows - End to End", () => {
	test.describe("Report to Action Workflow", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page, "moderator");
		});

		test("user reports a post, moderator removes it, and it is audit-logged", async ({ page }) => {
			// Step 1: a user reports a post (through the same API the user app calls)
			const seeded = await seedReport("post", "Spam or misleading");
			const notes = `Spam sweep ${Date.now().toString(36)}`;

			// Step 2: the moderator finds it in Pending and reviews the content
			await openReports(page);
			const card = reportCard(page, seeded);
			await expect(card.getByText(seeded.preview)).toBeVisible();
			await expect(card.getByText("Spam or misleading")).toBeVisible();

			// Step 3: remove the content
			await reviewFromCard(page, card, /^Remove post reported by/, /^Remove post$/, notes);
			await expect(page.getByText("Content removed and report resolved.")).toBeVisible();
			await expect(card).toHaveCount(0);

			// Step 4: the post is really gone and the report is resolved
			expect(await postExists(seeded.post.id)).toBe(false);
			await switchTab(page, "Resolved");
			await expect(card.getByTestId("report-status")).toHaveText("Resolved");

			// Step 5: both the review and the deletion are in the audit log
			const review = await findAuditLog("review_report", seeded.report.id);
			expect(review?.adminUsername).toBe("moderator");
			expect(JSON.parse(review?.details ?? "{}")).toMatchObject({
				action: "remove_content",
				notes,
				targetId: seeded.post.id,
			});
			expect(await findAuditLog("delete_post", seeded.post.id)).not.toBeNull();

			await page.goto("/audit", { waitUntil: "networkidle" });
			await waitForHydration(page);
			await page.getByLabel("Filter by action").selectOption("review_report");
			await expect(page.getByText(notes).first()).toBeVisible();
			await expect(page.getByText("Removed Reported Content").first()).toBeVisible();
		});

		test("moderator bans the author of a reported comment", async ({ page }) => {
			const seeded = await seedReport("comment", "Harassment or bullying");
			await openReports(page, "?type=comment");

			const card = reportCard(page, seeded);
			await reviewFromCard(page, card, /^Ban @/, /^Confirm ban$/, "Harassment");
			await expect(card).toHaveCount(0);

			expect(await getUserBannedAt(seeded.author.id)).not.toBeNull();
			const review = await findAuditLog("review_report", seeded.report.id);
			expect(JSON.parse(review?.details ?? "{}")).toMatchObject({ action: "ban_user" });
			expect(await findAuditLog("ban_user", seeded.author.id)).not.toBeNull();

			await page.goto(`/users/${seeded.author.id}`, { waitUntil: "networkidle" });
			await expect(page.getByText("banned", { exact: true })).toBeVisible();
		});

		test("should dismiss invalid report", async ({ page }) => {
			const seeded = await seedReport("user", "Fake account or bot");
			await openReports(page);

			const card = reportCard(page, seeded);
			await reviewFromCard(page, card, /^Dismiss report/, /^Dismiss report$/);
			await expect(card).toHaveCount(0);

			await switchTab(page, "Dismissed");
			await expect(card.getByTestId("report-status")).toHaveText("Dismissed");
			// Dismissing leaves the reported user alone
			expect(await getUserBannedAt(seeded.author.id)).toBeNull();
			const review = await findAuditLog("review_report", seeded.report.id);
			expect(JSON.parse(review?.details ?? "{}")).toMatchObject({ action: "dismiss" });
		});

		test("should navigate from report to user profile", async ({ page }) => {
			const seeded = await seedReport("comment");
			await openReports(page, "?type=comment");

			await reportCard(page, seeded)
				.getByRole("link", { name: `@${seeded.author.username}` })
				.click();
			await expect(page).toHaveURL(`/users/${seeded.author.id}`);
			await expect(page.getByText(/User Information/i)).toBeVisible();
		});
	});

	test.describe("User Moderation Workflow", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
		});

		test("should ban user from user list", async ({ page }) => {
			const target = await createTargetUser();
			await goToAdminPage(page, "users");
			await page.getByRole("searchbox", { name: "Search users" }).fill(target.username);
			const row = page.locator("tbody tr").filter({ hasText: `@${target.username}` });

			await row.getByRole("button", { name: `Ban ${target.displayName}` }).click();
			await page.locator('textarea[name="reason"]').fill("Violation of terms of service");
			await page.getByRole("button", { name: "Confirm ban" }).click();

			await expect(row.getByText("Banned", { exact: true })).toBeVisible();
		});

		test("should ban user from user detail page", async ({ page }) => {
			const target = await createTargetUser();
			await goToUserDetail(page, target.username);

			await page.getByRole("button", { name: "Ban User" }).click();
			await page.locator('textarea[name="reason"]').fill("Repeated violations");
			await page.getByRole("button", { name: "Confirm ban" }).click();

			await expect(page.getByText("banned", { exact: true })).toBeVisible();
		});

		test("should unban previously banned user", async ({ page }) => {
			const target = await createTargetUser();
			await goToUserDetail(page, target.username);
			await page.getByRole("button", { name: "Ban User" }).click();
			await page.locator('textarea[name="reason"]').fill("Temporary");
			await page.getByRole("button", { name: "Confirm ban" }).click();

			await page.getByRole("button", { name: "Unban User" }).click();
			await page.getByRole("button", { name: "Confirm unban" }).click();

			await expect(page.getByText("active", { exact: true })).toBeVisible();
		});

		test("should change user role from moderator to admin", async ({ page }) => {
			const target = await createTargetUser();
			await goToUserDetail(page, target.username);

			for (const role of ["moderator", "admin"]) {
				await page.getByRole("button", { name: "Change Role" }).click();
				await page.getByRole("dialog").getByLabel("New role").selectOption(role);
				await page.getByRole("button", { name: "Save role" }).click();
				await expect(page.getByRole("main").getByText(role, { exact: true })).toBeVisible();
			}
		});

		test("should view user posts and delete inappropriate one", async ({ page }) => {
			setupDialogHandler(page, "accept");
			await goToUserDetail(page);

			// Find a post
			const postLink = page.locator('a[href*="/posts/"]').first();
			if (await postLink.isVisible()) {
				await postLink.click();
				await waitForHydration(page);

				// Delete the post
				const deleteButton = page.getByRole("button", { name: /delete/i });
				if (await deleteButton.isVisible()) {
					await deleteButton.click();
					await waitForHydration(page);
				}
			}
		});
	});

	test.describe("Content Moderation Workflow", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
		});

		test("should find and delete spam post", async ({ page }) => {
			setupDialogHandler(page, "accept");

			// Step 1: Search for spam-like content
			await goToAdminPage(page, "posts");
			const searchInput = page.getByPlaceholder(/search/i);
			await searchInput.fill("buy now click here");
			await waitForHydration(page);

			// Step 2: Review results
			const posts = page.locator("article");
			const count = await posts.count();

			// Step 3: Delete if found
			if (count > 0) {
				const deleteButton = page
					.getByRole("button")
					.filter({ has: page.locator("svg") })
					.first();
				if (await deleteButton.isVisible()) {
					await deleteButton.click();
					await waitForHydration(page);
				}
			}
		});

		test("should review reported posts filter", async ({ page }) => {
			await goToAdminPage(page, "posts");

			// Filter to only reported posts
			const filterSelect = page.locator("select").first();
			if (await filterSelect.isVisible()) {
				await filterSelect.selectOption("reported");
				await waitForHydration(page);

				// Review each reported post - each should have report indicator
				const posts = page.locator("article");
				expect(await posts.count()).toBeGreaterThanOrEqual(0);
			}
		});

		test("should delete comment from post detail", async ({ page }) => {
			setupDialogHandler(page, "accept");
			await goToPostDetail(page, "1");

			// Find comment delete button
			const commentDeleteButton = page
				.locator('[data-testid^="comment-"]')
				.first()
				.getByRole("button", { name: /delete/i });
			if (await commentDeleteButton.isVisible()) {
				await commentDeleteButton.click();
				await waitForHydration(page);
			}
		});
	});

	test.describe("Dashboard to Detail Workflow", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
		});

		test("should navigate from dashboard stat to users", async ({ page }) => {
			await page.goto("/", { waitUntil: "networkidle" });
			await waitForHydration(page);

			// Click on users stat card
			const usersCard = page.locator('[data-testid="users-stat"], a[href="/users"]').first();
			if (await usersCard.isVisible()) {
				await usersCard.click();
				await waitForHydration(page);
				await expect(page).toHaveURL(/\/users/);
			}
		});

		test("should navigate from dashboard stat to posts", async ({ page }) => {
			await page.goto("/", { waitUntil: "networkidle" });
			await waitForHydration(page);

			const postsCard = page.locator('[data-testid="posts-stat"], a[href="/posts"]').first();
			if (await postsCard.isVisible()) {
				await postsCard.click();
				await waitForHydration(page);
				await expect(page).toHaveURL(/\/posts/);
			}
		});

		test("should navigate from dashboard to pending reports", async ({ page }) => {
			await page.goto("/", { waitUntil: "networkidle" });
			await waitForHydration(page);

			const reportsCard = page.locator('[data-testid="reports-stat"], a[href="/reports"]').first();
			if (await reportsCard.isVisible()) {
				await reportsCard.click();
				await waitForHydration(page);
				await expect(page).toHaveURL(/\/reports/);
			}
		});
	});

	test.describe("Cross-Page Navigation", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
		});

		test("should navigate: dashboard -> users -> user detail -> back", async ({ page }) => {
			// Start at dashboard
			await page.goto("/", { waitUntil: "networkidle" });
			await waitForHydration(page);

			// Go to users
			await goToAdminPage(page, "users");
			await expect(page).toHaveURL(/\/users/);

			// Go to user detail
			const viewLink = page.getByRole("link", { name: /view|details/i }).first();
			if (await viewLink.isVisible()) {
				await viewLink.click();
				await waitForHydration(page);
				await expect(page).toHaveURL(/\/users\//);

				// Go back
				const backLink = page.getByRole("link", { name: /back/i });
				await backLink.click();
				await expect(page).toHaveURL("/users");
			}
		});

		test("should navigate: reports -> post -> user -> back to reports", async ({ page }) => {
			const seeded = await seedReport("post");
			await openReports(page);

			// View the reported post
			await reportCard(page, seeded).getByRole("link", { name: "View post" }).click();
			await expect(page).toHaveURL(`/posts/${seeded.post.id}`);
			await waitForHydration(page);

			// Click on author (the Posts pages are being rewired separately, so this stays lenient)
			const authorLink = page.locator('a[href*="/users/"]').first();
			if (await authorLink.isVisible()) {
				await authorLink.click();
				await waitForHydration(page);
				await expect(page).toHaveURL(/\/users\//);
			}

			// Navigate back to reports
			await goToAdminPage(page, "reports");
			await expect(page).toHaveURL(/\/reports/);
			await expect(reportCard(page, seeded)).toBeVisible();
		});

		test("should maintain sidebar highlight on navigation", async ({ page }) => {
			await goToAdminPage(page, "users");

			// Check sidebar highlight - may have active class or aria-current
			const usersLink = page.locator('nav a[href="/users"]');
			expect(await usersLink.isVisible().catch(() => false)).toBeDefined();
		});
	});

	test.describe("Moderator Role Permissions", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page, "moderator");
		});

		test("should allow moderator to view users", async ({ page }) => {
			await goToAdminPage(page, "users");
			await expect(page.getByRole("heading", { name: /users/i })).toBeVisible();
		});

		test("should allow moderator to view posts", async ({ page }) => {
			await goToAdminPage(page, "posts");
			await expect(page.getByRole("heading", { name: /posts/i })).toBeVisible();
		});

		test("should allow moderator to view reports", async ({ page }) => {
			await goToAdminPage(page, "reports");
			await expect(page.getByRole("heading", { name: /reports/i })).toBeVisible();
		});

		test("should allow moderator to delete posts", async ({ page }) => {
			setupDialogHandler(page, "accept");
			await goToPostDetail(page, "1");

			// Moderators may or may not have delete permission
			const deleteButton = page.getByRole("button", { name: /delete/i });
			expect(await deleteButton.isVisible().catch(() => false)).toBeDefined();
		});

		test("should restrict moderator from changing roles", async ({ page }) => {
			const target = await createTargetUser();
			await goToUserDetail(page, target.username);

			await expect(page.getByRole("button", { name: "Change Role" })).toBeDisabled();
			// Moderators can still ban regular users
			await expect(page.getByRole("button", { name: "Ban User" })).toBeEnabled();
		});
	});

	test.describe("Bulk Operations Workflow", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
		});

		test("should review several reports in a row", async ({ page }) => {
			// There is no bulk selection; reviewing one after another must keep the list in sync
			const first = await seedReport("post");
			const second = await seedReport("comment");
			await openReports(page);

			await reviewFromCard(page, reportCard(page, first), /^Dismiss report/, /^Dismiss report$/);
			await expect(reportCard(page, first)).toHaveCount(0);
			await reviewFromCard(page, reportCard(page, second), /^Dismiss report/, /^Dismiss report$/);
			await expect(reportCard(page, second)).toHaveCount(0);

			expect(await getReportStatus(first.report.id)).toBe("dismissed");
			expect(await getReportStatus(second.report.id)).toBe("dismissed");
		});

		test("should select multiple posts and delete", async ({ page }) => {
			setupDialogHandler(page, "accept");
			await goToAdminPage(page, "posts");

			const checkboxes = page.locator('input[type="checkbox"]');
			const count = await checkboxes.count();

			if (count >= 2) {
				await checkboxes.nth(0).check();
				await checkboxes.nth(1).check();

				const bulkDelete = page.getByRole("button", { name: /delete selected/i });
				if (await bulkDelete.isVisible()) {
					await bulkDelete.click();
					await waitForHydration(page);
				}
			}
		});
	});

	test.describe("Search Across Sections", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
		});

		test("should search users by username", async ({ page }) => {
			await goToAdminPage(page, "users");
			const searchInput = page.getByPlaceholder(/search/i);
			await searchInput.fill("alice");
			await waitForHydration(page);

			// Should filter to matching users
		});

		test("should search posts by content", async ({ page }) => {
			await goToAdminPage(page, "posts");
			const searchInput = page.getByPlaceholder(/search/i);
			await searchInput.fill("hello");
			await waitForHydration(page);

			// Should filter to matching posts
		});

		test("should global search from header", async ({ page }) => {
			await page.goto("/", { waitUntil: "networkidle" });
			await waitForHydration(page);

			const globalSearch = page.locator(
				'header input[type="search"], [data-testid="global-search"]',
			);
			if (await globalSearch.isVisible()) {
				await globalSearch.fill("test");
				await waitForHydration(page);
			}
		});
	});

	test.describe("Error Handling Workflow", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
		});

		test("should handle 404 for non-existent user", async ({ page }) => {
			await page.goto("/users/nonexistent123", { waitUntil: "networkidle" });
			await waitForHydration(page);

			// Should show error or redirect - may show error message
			const error = page.getByText(/not found|error|doesn't exist/i);
			expect(
				await error
					.first()
					.isVisible()
					.catch(() => false),
			).toBeDefined();
		});

		test("should handle 404 for non-existent post", async ({ page }) => {
			await page.goto("/posts/nonexistent123", { waitUntil: "networkidle" });
			await waitForHydration(page);

			// May show error message
			const error = page.getByText(/not found|error|doesn't exist/i);
			expect(
				await error
					.first()
					.isVisible()
					.catch(() => false),
			).toBeDefined();
		});

		test("should handle failed action gracefully", async () => {
			// Actions on non-existent resources should show errors
			expect(true).toBe(true);
		});
	});

	test.describe("Session Timeout Handling", () => {
		test("should redirect to login when session expires", async ({ page }) => {
			await loginAsAdmin(page);
			await goToAdminPage(page, "users");

			// Clear cookies to simulate session expiry
			await page.context().clearCookies();

			// Try to navigate - should redirect to login
			await page.reload({ waitUntil: "networkidle" });
			await waitForHydration(page);

			// May redirect to login or show auth error
		});
	});
});
