import { expect, type Page, test } from "@playwright/test";
import { fetchAuditLogs, fetchDashboardStats } from "./fixtures/admin-api";
import { registerUser } from "./fixtures/content-helpers";
import { loginAsAdmin, waitForHydration } from "./fixtures/test-helpers";

/** The stat card with this label. */
const statCard = (page: Page, label: string) =>
	page.getByTestId("stat-card").filter({ has: page.getByText(label, { exact: true }) });

/** The numeric value a stat card shows, once it has loaded. */
async function statValue(page: Page, label: string): Promise<number> {
	const value = statCard(page, label).getByTestId("stat-value");
	await expect(value).toHaveText(/^[\d,]+$/);
	return Number((await value.textContent())?.replace(/,/g, ""));
}

test.describe("Admin Dashboard - Comprehensive", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test.describe("Dashboard Display", () => {
		test("should display dashboard heading", async ({ page }) => {
			await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
		});

		test("should show four stat cards", async ({ page }) => {
			await expect(page.getByTestId("stat-card")).toHaveCount(4);
			for (const label of ["Total Users", "Total Posts", "Comments", "Pending Reports"]) {
				await expect(statCard(page, label)).toBeVisible();
			}
		});

		test("should show the totals the API reports", async ({ page }) => {
			// Other suites write to the same database, so the page must fall
			// between a fetch made before it loaded and one made after.
			const before = await fetchDashboardStats();
			await page.reload({ waitUntil: "networkidle" });
			const shown = {
				users: await statValue(page, "Total Users"),
				posts: await statValue(page, "Total Posts"),
				comments: await statValue(page, "Comments"),
			};
			const after = await fetchDashboardStats();

			// Deletions elsewhere can lower totals too, so allow either direction
			const between = (value: number, a: number, b: number) => {
				expect(value).toBeGreaterThanOrEqual(Math.min(a, b));
				expect(value).toBeLessThanOrEqual(Math.max(a, b));
			};
			between(shown.users, before.totalUsers, after.totalUsers);
			between(shown.posts, before.totalPosts, after.totalPosts);
			between(shown.comments, before.totalComments, after.totalComments);
		});

		test("should count a user registered just now", async ({ page }) => {
			const before = await fetchDashboardStats();
			await registerUser("dash");
			await page.reload({ waitUntil: "networkidle" });
			const shown = await statValue(page, "Total Users");
			const after = await fetchDashboardStats();

			// One more than before, unless another suite deleted users meanwhile
			expect(shown).toBeGreaterThanOrEqual(Math.min(before.totalUsers + 1, after.totalUsers));
			await expect(statCard(page, "Total Users").getByTestId("stat-change")).toContainText(
				/\+[\d,]+ today/,
			);
		});

		test("should show banned users and today's posts as secondary info", async ({ page }) => {
			await expect(statCard(page, "Total Users").getByTestId("stat-change")).toContainText(
				/banned user/,
			);
			await expect(statCard(page, "Total Posts").getByTestId("stat-change")).toContainText(/today/);
			// The old mock compared against a month that was never measured
			await expect(page.getByText(/from last month/)).toHaveCount(0);
		});

		test("should summarise pending reports", async ({ page }) => {
			const pending = await statValue(page, "Pending Reports");
			const change = statCard(page, "Pending Reports").getByTestId("stat-change");
			await expect(change).toHaveText(pending === 0 ? "All clear" : /need review/);
		});
	});

	test.describe("Recent Activity", () => {
		test("should list recent activity newest first", async ({ page }) => {
			// Registering guarantees at least one item exists
			await registerUser("dash");
			await page.reload({ waitUntil: "networkidle" });

			const items = page.getByTestId("activity-item");
			await expect(items.first()).toBeVisible();
			const count = await items.count();
			expect(count).toBeGreaterThan(0);
			expect(count).toBeLessThanOrEqual(8);

			const times = await items
				.locator("time")
				.evaluateAll((els) => els.map((el) => Date.parse(el.getAttribute("datetime") ?? "")));
			expect(times.every((t) => !Number.isNaN(t))).toBe(true);
			expect([...times].sort((a, b) => b - a)).toEqual(times);
			await expect(items.first().locator("time")).toHaveText(/ago|Just now/);
		});

		test("should be at least as recent as the latest audit entry", async ({ page }) => {
			const { logs } = await fetchAuditLogs({ limit: 1 });
			await page.reload({ waitUntil: "networkidle" });
			const first = page.getByTestId("activity-item").first().locator("time");
			await expect(first).toBeVisible();
			if (logs[0]?.createdAt) {
				const newestAudit = Number(logs[0].createdAt.seconds) * 1000;
				const shown = Date.parse((await first.getAttribute("datetime")) ?? "");
				expect(shown).toBeGreaterThanOrEqual(newestAudit);
			}
		});

		test("should link to the full audit log", async ({ page }) => {
			await page.getByRole("link", { name: /full audit log/i }).click();
			await expect(page).toHaveURL("/audit");
			await expect(page.getByRole("heading", { name: "Audit Log" })).toBeVisible();
		});
	});

	test.describe("Dashboard Navigation", () => {
		test("should have navigation links", async ({ page }) => {
			await expect(page.getByRole("link", { name: /users/i })).toBeVisible();
			await expect(page.getByRole("link", { name: /posts/i })).toBeVisible();
			await expect(page.getByRole("link", { name: /reports/i })).toBeVisible();
		});

		test("should open the moderation queue from the pending reports card", async ({ page }) => {
			await page.getByRole("link", { name: /moderation queue/i }).click();
			await expect(page).toHaveURL("/reports");
			await expect(page.getByRole("heading", { name: /reports/i }).first()).toBeVisible();
		});

		test("should navigate to users page", async ({ page }) => {
			await page.click('a[href="/users"]');
			await waitForHydration(page);

			await expect(page).toHaveURL("/users");
			await expect(page.getByRole("heading", { name: /users/i })).toBeVisible();
		});

		test("should navigate to posts page", async ({ page }) => {
			await page.click('a[href="/posts"]');
			await waitForHydration(page);

			await expect(page).toHaveURL("/posts");
			await expect(page.getByRole("heading", { name: /posts/i })).toBeVisible();
		});

		test("should return to dashboard from other pages", async ({ page }) => {
			await page.goto("/users", { waitUntil: "networkidle" });
			await waitForHydration(page);

			const dashboardLink = page.getByRole("link", { name: /dashboard|home/i });
			await dashboardLink.click();
			await waitForHydration(page);

			await expect(page).toHaveURL("/");
		});
	});

	test.describe("Dashboard Header", () => {
		test("should display admin username", async ({ page }) => {
			await expect(page.getByRole("banner").first()).toBeVisible();
			// Header shows username + role badge, read as "adminadmin"
			await expect(page.getByText(/adminadmin/i)).toBeVisible();
		});

		test("should have logout button", async ({ page }) => {
			await expect(page.getByRole("button", { name: /logout|sign out/i })).toBeVisible();
		});
	});

	test.describe("Dashboard Responsiveness", () => {
		for (const viewport of [
			{ name: "mobile", width: 375, height: 667 },
			{ name: "tablet", width: 768, height: 1024 },
		]) {
			test(`should show stats on ${viewport.name} viewport`, async ({ page }) => {
				await page.setViewportSize({ width: viewport.width, height: viewport.height });
				await page.reload({ waitUntil: "networkidle" });

				await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
				await expect(statCard(page, "Total Users").getByTestId("stat-value")).toHaveText(
					/^[\d,]+$/,
				);
			});
		}
	});
});
