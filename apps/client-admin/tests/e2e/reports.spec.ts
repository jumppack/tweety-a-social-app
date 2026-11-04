import { expect, test } from "@playwright/test";
import {
	openReports,
	postExists,
	reportCard,
	reviewFromCard,
	seedReport,
	statusTab,
	switchTab,
	tabCount,
} from "./fixtures/report-helpers";
import { loginAsAdmin } from "./fixtures/test-helpers";

test.describe("Reports Management", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test("shows the reports page with status tabs and real counts", async ({ page }) => {
		await openReports(page);

		await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible();
		for (const name of ["Pending", "Resolved", "Dismissed", "All"] as const) {
			await expect(statusTab(page, name)).toHaveText(/\(\d+\)/);
		}
		await expect(statusTab(page, "Pending")).toHaveAttribute("aria-selected", "true");

		const all = await tabCount(page, "All");
		const sum =
			(await tabCount(page, "Pending")) +
			(await tabCount(page, "Resolved")) +
			(await tabCount(page, "Dismissed"));
		// Reports may arrive between the four counts; "reviewed" is never set
		expect(all).toBeGreaterThanOrEqual(sum - 5);
	});

	test("a fresh post report appears in Pending with its details", async ({ page }) => {
		const seeded = await seedReport("post", "Spam or misleading");
		await openReports(page);

		const card = reportCard(page, seeded);
		await expect(card).toBeVisible();
		await expect(card.getByText("post", { exact: true })).toBeVisible();
		await expect(card.getByText(seeded.preview)).toBeVisible();
		await expect(card.getByText("Spam or misleading")).toBeVisible();
		await expect(card.getByRole("link", { name: `@${seeded.reporter.username}` })).toBeVisible();
		await expect(card.getByRole("link", { name: `@${seeded.author.username}` })).toHaveAttribute(
			"href",
			`/users/${seeded.author.id}`,
		);
		await expect(card.getByRole("link", { name: "View post" })).toHaveAttribute(
			"href",
			`/posts/${seeded.post.id}`,
		);
		await expect(card.getByText("just now")).toBeVisible();
		await expect(card.getByTestId("report-status")).toHaveText("Pending");

		const reporter = `@${seeded.reporter.username}`;
		await expect(
			card.getByRole("button", { name: `Dismiss report from ${reporter}` }),
		).toBeVisible();
		await expect(
			card.getByRole("button", { name: `Remove post reported by ${reporter}` }),
		).toBeVisible();
		await expect(card.getByRole("button", { name: /^Ban @author_/ })).toBeVisible();
	});

	test("dismissing a report moves it to Dismissed and keeps the post", async ({ page }) => {
		const seeded = await seedReport("post");
		await openReports(page);
		const dismissedBefore = await tabCount(page, "Dismissed");

		const card = reportCard(page, seeded);
		const dialog = await reviewFromCard(page, card, /^Dismiss report/, /^Dismiss report$/);
		await expect(dialog).toBeHidden();
		await expect(page.getByText("Report dismissed.")).toBeVisible();
		await expect(card).toHaveCount(0);

		// Statuses only ever leave "pending", so the Dismissed count can only grow
		expect(await tabCount(page, "Dismissed")).toBeGreaterThan(dismissedBefore);

		await switchTab(page, "Dismissed");
		await expect(card.getByTestId("report-status")).toHaveText("Dismissed");
		await expect(card.getByText(seeded.preview)).toBeVisible();
		await expect(card.getByRole("button", { name: /Dismiss/ })).toHaveCount(0);
		expect(await postExists(seeded.post.id)).toBe(true);
	});

	test("shows an empty state for a tab with no matching reports", async ({ page }) => {
		await openReports(page, "?status=dismissed&type=user");
		const count = await tabCount(page, "Dismissed");
		if (count === 0) {
			await expect(page.getByText("No dismissed user reports")).toBeVisible();
		} else {
			// Another spec has dismissed a user report; the list must then show cards
			await expect(page.locator("article").first()).toBeVisible();
			await expect(page.getByText("No dismissed user reports")).toHaveCount(0);
		}
	});
});
