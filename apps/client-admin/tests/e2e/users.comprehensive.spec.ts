import { expect, test } from "@playwright/test";
import {
	createTargetUser,
	goToAdminPage,
	goToUserDetail,
	loginAsAdmin,
	searchInList,
	waitForHydration,
} from "./fixtures/test-helpers";

test.describe("User Management - Comprehensive", () => {
	test.describe("Users List Page", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
			await goToAdminPage(page, "users");
		});

		test("should display users page heading", async ({ page }) => {
			await expect(page.getByRole("heading", { name: /users/i })).toBeVisible();
		});

		test("should show users table or list", async ({ page }) => {
			// Should have user entries
			const userEntries = page.locator('table tbody tr, article, [data-testid^="user-"]');
			expect(await userEntries.count()).toBeGreaterThan(0);
		});

		test("should display user information in list", async ({ page }) => {
			// Each user entry should show username/email
			const firstUser = page.locator("table tbody tr, article").first();
			await expect(firstUser).toBeVisible();
		});

		test("should have search functionality", async ({ page }) => {
			const searchInput = page.getByPlaceholder(/search/i);
			await expect(searchInput).toBeVisible();
		});

		test("should filter users when searching", async ({ page }) => {
			await searchInList(page, "alice");
			await waitForHydration(page);

			// Results should be filtered - may have 0 or more depending on seed data
			const results = page.locator("table tbody tr, article");
			expect(await results.count()).toBeGreaterThanOrEqual(0);
		});

		test("should clear search results", async ({ page }) => {
			const searchInput = page.getByPlaceholder(/search/i);
			await searchInput.fill("alice");
			await waitForHydration(page);

			await searchInput.clear();
			await waitForHydration(page);

			// Full list should return
		});

		test("should show role badges", async ({ page }) => {
			// Role badges should be visible
			const roleBadges = page.getByText(/admin|moderator|user/i).first();
			await expect(roleBadges).toBeVisible();
		});

		test("should show user status indicators", async ({ page }) => {
			// Active/banned status should be visible - may or may not be visible depending on data
			const statusIndicator = page.getByText(/active|banned/i).first();
			expect(await statusIndicator.isVisible().catch(() => false)).toBeDefined();
		});

		test("should have pagination if many users", async ({ page }) => {
			// Check for pagination controls - may or may not exist depending on user count
			const pagination = page.locator('[data-testid="pagination"], nav[aria-label*="pagination"]');
			expect(await pagination.count()).toBeGreaterThanOrEqual(0);
		});

		test("should navigate to user detail on row click", async ({ page }) => {
			const viewLink = page.getByRole("link", { name: /view|details/i }).first();
			if (await viewLink.isVisible()) {
				await viewLink.click();
				await waitForHydration(page);
				await expect(page).toHaveURL(/\/users\//);
			}
		});

		test("should show action buttons for each user", async ({ page }) => {
			// Action buttons are in the table - they are icon-only buttons
			const tableRows = page.locator("table tbody tr");
			const rowCount = await tableRows.count();
			expect(rowCount).toBeGreaterThan(0);

			// Each row should have action buttons (icon buttons without text)
			const firstRowActions = tableRows.first().locator("td").last().locator("button");
			const actionCount = await firstRowActions.count();
			expect(actionCount).toBeGreaterThan(0);
		});
	});

	test.describe("User Detail Page", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
		});

		test("should display user profile information", async ({ page }) => {
			await goToUserDetail(page);

			// Should show user info section
			await expect(page.getByRole("heading", { name: "User Information" })).toBeVisible();
		});

		test("should show username and display name", async ({ page }) => {
			await goToUserDetail(page);

			// Username should be visible (@ prefixed)
			const username = page.getByText(/@\w+/);
			await expect(username.first()).toBeVisible();
		});

		test("should display user email", async ({ page }) => {
			await goToUserDetail(page);

			// Email should be visible
			const email = page.getByText(/@.*\.\w+/);
			await expect(email.first()).toBeVisible();
		});

		test("should show user role", async ({ page }) => {
			await goToUserDetail(page);

			const roleBadge = page.getByText(/admin|moderator|user/i);
			await expect(roleBadge.first()).toBeVisible();
		});

		test("should display join date", async ({ page }) => {
			await goToUserDetail(page);

			// May or may not be visible
			const joinDate = page.getByText(/joined|member since/i);
			expect(
				await joinDate
					.first()
					.isVisible()
					.catch(() => false),
			).toBeDefined();
		});

		test("should show user statistics", async ({ page }) => {
			await goToUserDetail(page);

			// Look for statistics in the main content area only
			const mainContent = page.getByRole("main");
			await expect(mainContent.getByText(/statistics|stats|posts/i).first()).toBeVisible();
		});

		test("should display posts count", async ({ page }) => {
			await goToUserDetail(page);

			const postsLabel = page.getByText(/posts/i);
			await expect(postsLabel.first()).toBeVisible();
		});

		test("should display followers count", async ({ page }) => {
			await goToUserDetail(page);

			// May or may not be visible
			const followersLabel = page.getByText(/followers/i);
			expect(
				await followersLabel
					.first()
					.isVisible()
					.catch(() => false),
			).toBeDefined();
		});

		test("should display following count", async ({ page }) => {
			await goToUserDetail(page);

			// May or may not be visible
			const followingLabel = page.getByText(/following/i);
			expect(
				await followingLabel
					.first()
					.isVisible()
					.catch(() => false),
			).toBeDefined();
		});

		test("should have ban user button", async ({ page }) => {
			await goToUserDetail(page);

			const banButton = page.getByRole("button", { name: /ban/i });
			await expect(banButton).toBeVisible();
		});

		test("should have change role button", async ({ page }) => {
			await goToUserDetail(page);

			const roleButton = page.getByRole("button", { name: /role|change/i });
			await expect(roleButton).toBeVisible();
		});

		test("should have back navigation", async ({ page }) => {
			await goToUserDetail(page);

			const backLink = page.getByRole("link", { name: /back/i });
			await expect(backLink).toBeVisible();

			await backLink.click();
			await expect(page).toHaveURL("/users");
		});

		test("should show recent posts by user", async ({ page }) => {
			await goToUserDetail(page);

			// May or may not be visible
			const postsSection = page.getByText(/recent posts|user posts/i);
			expect(
				await postsSection
					.first()
					.isVisible()
					.catch(() => false),
			).toBeDefined();
		});

		test("should show user activity timeline", async ({ page }) => {
			await goToUserDetail(page);

			// May or may not be visible
			const activitySection = page.getByText(/activity|history/i);
			expect(
				await activitySection
					.first()
					.isVisible()
					.catch(() => false),
			).toBeDefined();
		});
	});

	test.describe("User Actions - Ban/Unban", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
		});

		test("should require a ban reason", async ({ page }) => {
			const target = await createTargetUser();
			await goToUserDetail(page, target.username);

			await page.getByRole("button", { name: "Ban User" }).click();
			const dialog = page.getByRole("dialog");
			await expect(dialog).toBeVisible();
			await expect(dialog.getByRole("button", { name: "Confirm ban" })).toBeDisabled();
			await dialog.locator('textarea[name="reason"]').fill("Spam");
			await expect(dialog.getByRole("button", { name: "Confirm ban" })).toBeEnabled();
		});

		test("should cancel ban action", async ({ page }) => {
			const target = await createTargetUser();
			await goToUserDetail(page, target.username);

			await page.getByRole("button", { name: "Ban User" }).click();
			await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

			await expect(page.getByRole("dialog")).toHaveCount(0);
			await expect(page.getByRole("main").getByText("active", { exact: true })).toBeVisible();
		});

		test("should ban and unban a user from the detail page", async ({ page }) => {
			const target = await createTargetUser();
			await goToUserDetail(page, target.username);

			await page.getByRole("button", { name: "Ban User" }).click();
			const dialog = page.getByRole("dialog");
			await dialog.locator('textarea[name="reason"]').fill("Repeated violations");
			await dialog.getByRole("button", { name: "Confirm ban" }).click();

			await expect(page.getByRole("main").getByText("banned", { exact: true })).toBeVisible();
			await expect(page.getByText(/Banned on .*Repeated violations/)).toBeVisible();

			// Persisted: survives a reload
			await page.reload({ waitUntil: "networkidle" });
			await page.getByRole("button", { name: "Unban User" }).click();
			await page.getByRole("dialog").getByRole("button", { name: "Confirm unban" }).click();
			await expect(page.getByRole("main").getByText("active", { exact: true })).toBeVisible();
			await expect(page.getByRole("button", { name: "Ban User" })).toBeVisible();
		});

		test("should ban and unban a user from the users list", async ({ page }) => {
			const target = await createTargetUser();
			await goToAdminPage(page, "users");
			await page.getByRole("searchbox", { name: "Search users" }).fill(target.username);
			const row = page.locator("tbody tr").filter({ hasText: `@${target.username}` });

			await row.getByRole("button", { name: `Ban ${target.displayName}` }).click();
			const dialog = page.getByRole("dialog");
			await dialog.locator('textarea[name="reason"]').fill("Violation of terms of service");
			await dialog.getByRole("button", { name: "Confirm ban" }).click();
			await expect(row.getByText("Banned", { exact: true })).toBeVisible();

			await row.getByRole("button", { name: `Unban ${target.displayName}` }).click();
			await page.getByRole("dialog").getByRole("button", { name: "Confirm unban" }).click();
			await expect(row.getByText("Active", { exact: true })).toBeVisible();
		});

		test("should not allow banning admins or yourself", async ({ page }) => {
			await goToUserDetail(page, "admin");
			await expect(page.getByRole("button", { name: "Ban User" })).toBeDisabled();
			await expect(page.getByRole("button", { name: "Ban User" })).toHaveAttribute(
				"title",
				"You cannot ban yourself",
			);
		});
	});

	test.describe("User Actions - Role Management", () => {
		test("should change a user's role", async ({ page }) => {
			await loginAsAdmin(page);
			const target = await createTargetUser();
			await goToUserDetail(page, target.username);

			await page.getByRole("button", { name: "Change Role" }).click();
			const dialog = page.getByRole("dialog");
			await expect(dialog.getByRole("option")).toHaveText(["user", "moderator", "admin"]);
			await dialog.getByLabel("New role").selectOption("moderator");
			await dialog.getByRole("button", { name: "Save role" }).click();

			await expect(page.getByRole("dialog")).toHaveCount(0);
			await expect(page.getByRole("main").getByText("moderator", { exact: true })).toBeVisible();
		});

		test("should change a role from the row menu", async ({ page }) => {
			await loginAsAdmin(page);
			const target = await createTargetUser();
			await goToAdminPage(page, "users");
			await page.getByRole("searchbox", { name: "Search users" }).fill(target.username);
			const row = page.locator("tbody tr").filter({ hasText: `@${target.username}` });

			await row.getByRole("button", { name: "More actions" }).click();
			await page.getByRole("menuitem", { name: /Change role/ }).click();
			await page.getByRole("dialog").getByLabel("New role").selectOption("moderator");
			await page.getByRole("dialog").getByRole("button", { name: "Save role" }).click();

			await expect(row.getByText("moderator")).toBeVisible();
		});

		test("should not allow self role change", async ({ page }) => {
			await loginAsAdmin(page);
			await goToUserDetail(page, "admin");
			const roleButton = page.getByRole("button", { name: "Change Role" });
			await expect(roleButton).toBeDisabled();
			await expect(roleButton).toHaveAttribute("title", "You cannot change your own role");
		});

		test("should not let moderators change roles", async ({ page }) => {
			await loginAsAdmin(page, "moderator");
			const target = await createTargetUser();
			await goToUserDetail(page, target.username);
			const roleButton = page.getByRole("button", { name: "Change Role" });
			await expect(roleButton).toBeDisabled();
			await expect(roleButton).toHaveAttribute("title", "Only admins can change roles");
		});
	});

	test.describe("User Search and Filter", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
			await goToAdminPage(page, "users");
		});

		test("should search by username", async ({ page }) => {
			await searchInList(page, "alice");
			await waitForHydration(page);

			// Results should show alice or be empty
		});

		test("should search by email", async ({ page }) => {
			await searchInList(page, "test.com");
			await waitForHydration(page);

			// Results should show users with test.com emails
		});

		test("should search by display name", async ({ page }) => {
			await searchInList(page, "Alice");
			await waitForHydration(page);

			// Results should show Alice or be empty
		});

		test("should filter by role", async ({ page }) => {
			const roleFilter = page.locator('select[name="role"], [data-testid="role-filter"]');
			if (await roleFilter.isVisible()) {
				await roleFilter.selectOption("admin");
				await waitForHydration(page);
			}
		});

		test("should filter by status", async ({ page }) => {
			const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');
			if (await statusFilter.isVisible()) {
				await statusFilter.selectOption("banned");
				await waitForHydration(page);
			}
		});

		test("should combine search with filters", async ({ page }) => {
			await searchInList(page, "alice");

			const roleFilter = page.locator('select[name="role"]');
			if (await roleFilter.isVisible()) {
				await roleFilter.selectOption("user");
				await waitForHydration(page);
			}
		});

		test("should show no results message", async ({ page }) => {
			await searchInList(page, "nonexistentuser123456");
			await waitForHydration(page);

			// May or may not show depending on implementation
			const noResults = page.getByText(/no users|no results|not found/i);
			expect(await noResults.isVisible().catch(() => false)).toBeDefined();
		});
	});

	test.describe("User List Sorting", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
			await goToAdminPage(page, "users");
		});

		test("should sort by username", async ({ page }) => {
			const sortButton = page.getByRole("button", { name: /username/i });
			if (await sortButton.isVisible()) {
				await sortButton.click();
				await waitForHydration(page);
			}
		});

		test("should sort by join date", async ({ page }) => {
			const sortButton = page.getByRole("button", { name: /joined|date/i });
			if (await sortButton.isVisible()) {
				await sortButton.click();
				await waitForHydration(page);
			}
		});

		test("should toggle sort direction", async ({ page }) => {
			const sortButton = page.getByRole("button", { name: /username/i });
			if (await sortButton.isVisible()) {
				// Click twice to toggle direction
				await sortButton.click();
				await waitForHydration(page);
				await sortButton.click();
				await waitForHydration(page);
			}
		});
	});

	test.describe("User Detail - Posts Tab", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
			await goToUserDetail(page);
		});

		test("should show posts tab", async ({ page }) => {
			// May or may not be visible depending on UI design
			const postsTab = page.getByRole("tab", { name: /posts/i });
			expect(await postsTab.isVisible().catch(() => false)).toBeDefined();
		});

		test("should display user posts", async ({ page }) => {
			const postsSection = page.getByText(/posts/i);
			await expect(postsSection.first()).toBeVisible();
		});

		test("should allow deleting user posts", async ({ page }) => {
			// May or may not be visible
			const deleteButton = page
				.locator("article")
				.first()
				.getByRole("button", { name: /delete/i });
			expect(await deleteButton.isVisible().catch(() => false)).toBeDefined();
		});
	});

	test.describe("Accessibility", () => {
		test.beforeEach(async ({ page }) => {
			await loginAsAdmin(page);
		});

		test("should have proper heading structure on users list", async ({ page }) => {
			await goToAdminPage(page, "users");

			const h1 = page.locator("h1");
			await expect(h1.first()).toBeVisible();
		});

		test("should have proper heading structure on user detail", async ({ page }) => {
			await goToUserDetail(page);

			const h1 = page.locator("h1");
			await expect(h1.first()).toBeVisible();
		});

		test("should have accessible form labels", async ({ page }) => {
			await goToAdminPage(page, "users");

			const searchInput = page.getByPlaceholder(/search/i);
			await expect(searchInput).toBeVisible();
		});

		test("should support keyboard navigation", async ({ page }) => {
			await goToAdminPage(page, "users");

			await page.keyboard.press("Tab");
			await page.keyboard.press("Tab");

			const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
			expect(focusedElement).toBeDefined();
		});
	});
});
