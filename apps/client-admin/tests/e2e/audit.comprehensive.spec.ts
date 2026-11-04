import { expect, type Page, test } from "@playwright/test";
import {
	banUserViaApi,
	deletePostViaApi,
	fetchAuditLogs,
	reviewReportViaApi,
} from "./fixtures/admin-api";
import { createPost, registerUser, seedReportedContent } from "./fixtures/content-helpers";
import {
	createTargetUser,
	goToUserDetail,
	loginAsAdmin,
	uniqueId,
	waitForHydration,
} from "./fixtures/test-helpers";

const PAGE_SIZE = 50;

async function goToAudit(page: Page) {
	await page.goto("/audit", { waitUntil: "networkidle" });
	await waitForHydration(page);
	await expect(page.getByText("Loading audit log…")).toHaveCount(0);
}

/** The audit entry whose text contains `text` (e.g. a unique reason or username). */
const entryWith = (page: Page, text: string) =>
	page.getByTestId("audit-entry").filter({ hasText: text });

test.describe("Audit Logs - Comprehensive", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test.describe("Audit Page Access", () => {
		test("should display audit page heading", async ({ page }) => {
			await goToAudit(page);
			await expect(page.getByRole("heading", { name: "Audit Log", level: 1 })).toBeVisible();
		});

		test("should navigate to audit from the header", async ({ page }) => {
			await page.getByRole("link", { name: "Audit Log", exact: true }).click();
			await expect(page).toHaveURL("/audit");
			await expect(page.getByRole("heading", { name: "Audit Log", level: 1 })).toBeVisible();
		});

		test("should show real entries, not the old mock", async ({ page }) => {
			// Guarantee at least one entry exists
			const target = await registerUser("audit");
			await banUserViaApi(target.id, uniqueId("reason"));
			await goToAudit(page);

			await expect(page.getByTestId("audit-entry").first()).toBeVisible();
			await expect(page.getByText("Initial admin account configured")).toHaveCount(0);
			await expect(page.getByText("Assigned moderator role during platform setup")).toHaveCount(0);
		});
	});

	test.describe("Audit Log Actions", () => {
		test("should log a ban and unban made in the UI", async ({ page }) => {
			// Never act on a seeded user: banning alice broke every test that logs in as her
			const target = await createTargetUser();
			const reason = uniqueId("Audit ban");
			await goToUserDetail(page, target.username);

			await page.getByRole("button", { name: "Ban User" }).click();
			const dialog = page.getByRole("dialog");
			await dialog.locator('textarea[name="reason"]').fill(reason);
			await dialog.getByRole("button", { name: "Confirm ban" }).click();
			await expect(page.getByRole("button", { name: "Unban User" })).toBeVisible();

			await page.getByRole("button", { name: "Unban User" }).click();
			await page.getByRole("dialog").getByRole("button", { name: "Confirm unban" }).click();
			await expect(page.getByRole("button", { name: "Ban User" })).toBeVisible();

			await goToAudit(page);
			const ban = entryWith(page, reason);
			await expect(ban).toHaveCount(1);
			await expect(ban.getByTestId("audit-action")).toHaveText("Banned User");
			await expect(ban.getByTestId("action-details")).toHaveText(`Reason: ${reason}`);
			await expect(ban.getByRole("link", { name: "@admin" })).toBeVisible();
			await expect(ban.getByRole("link", { name: `@${target.username}` })).toHaveAttribute(
				"href",
				/^\/users\/[^/]+$/,
			);
			await expect(ban.locator("time")).toHaveText(/Just now|minute/);

			const unban = page
				.getByTestId("audit-entry")
				.filter({ hasText: "Unbanned User" })
				.filter({ hasText: `@${target.username}` });
			await expect(unban).toHaveCount(1);
		});

		test("should log a role change made in the UI", async ({ page }) => {
			const target = await createTargetUser();
			await goToUserDetail(page, target.username);

			await page.getByRole("button", { name: "Change Role" }).click();
			const dialog = page.getByRole("dialog");
			await dialog.locator("select").selectOption("moderator");
			await dialog.getByRole("button", { name: "Save role" }).click();
			await expect(dialog).toBeHidden();

			await goToAudit(page);
			const entry = entryWith(page, `@${target.username}`).filter({ hasText: "Changed Role" });
			await expect(entry).toHaveCount(1);
			await expect(entry.getByTestId("action-details")).toHaveText("user → moderator");
		});

		test("should log a post deletion with a link to the post", async ({ page }) => {
			const author = await registerUser("audit");
			const post = await createPost(author);
			const reason = uniqueId("Audit delete");
			await deletePostViaApi(post.id, reason);

			await goToAudit(page);
			const entry = entryWith(page, reason);
			await expect(entry.getByTestId("audit-action")).toHaveText("Deleted Post");
			await expect(entry.getByTestId("resource-link")).toHaveAttribute("href", `/posts/${post.id}`);
		});

		test("should log a dismissed report with its notes", async ({ page }) => {
			const { post, report } = await seedReportedContent("post");
			const notes = uniqueId("Audit notes");
			await reviewReportViaApi(report.id, "dismiss", notes);

			await goToAudit(page);
			const entry = entryWith(page, notes);
			await expect(entry.getByTestId("audit-action")).toHaveText("Dismissed Report");
			await expect(entry.getByTestId("action-details")).toHaveText(`Notes: ${notes}`);
			// The target is the reported post, not the report row
			await expect(entry.getByTestId("resource-link")).toHaveAttribute("href", `/posts/${post.id}`);
		});
	});

	test.describe("Audit Log Layout", () => {
		test("should group entries by date, newest first, starting with Today", async ({ page }) => {
			const target = await registerUser("audit");
			await banUserViaApi(target.id, uniqueId("reason"));
			await goToAudit(page);

			await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("Today");
			const times = await page
				.getByTestId("audit-entry")
				.locator("time")
				.evaluateAll((els) => els.map((el) => Date.parse(el.getAttribute("datetime") ?? "")));
			expect(times.length).toBeGreaterThan(0);
			expect([...times].sort((a, b) => b - a)).toEqual(times);
		});

		test("should open a user target from its entry", async ({ page }) => {
			const target = await registerUser("audit");
			const reason = uniqueId("Audit link");
			await banUserViaApi(target.id, reason);

			await goToAudit(page);
			await entryWith(page, reason)
				.getByRole("link", { name: `@${target.username}` })
				.click();
			await expect(page).toHaveURL(`/users/${target.id}`);
			await expect(page.getByRole("heading", { name: "User Information" })).toBeVisible();
		});
	});

	test.describe("Audit Log Filtering", () => {
		test("should offer every logged action type", async ({ page }) => {
			await goToAudit(page);
			const filter = page.getByRole("combobox", { name: "Filter by action" });
			await expect(filter.locator("option")).toHaveText([
				"All actions",
				"Banned user",
				"Unbanned user",
				"Changed role",
				"Deleted user",
				"Deleted post",
				"Deleted comment",
				"Reviewed report",
			]);
		});

		test("should filter by action type on the server", async ({ page }) => {
			const target = await registerUser("audit");
			const reason = uniqueId("Audit filter");
			await banUserViaApi(target.id, reason);
			const author = await registerUser("audit");
			const post = await createPost(author);
			await deletePostViaApi(post.id, uniqueId("Audit filter delete"));

			await goToAudit(page);
			const filter = page.getByRole("combobox", { name: "Filter by action" });
			await filter.selectOption("ban_user");

			const entries = page.getByTestId("audit-entry");
			await expect(entryWith(page, reason)).toHaveCount(1);
			await expect(entries.and(page.locator(':not([data-action="ban_user"])'))).toHaveCount(0);

			await filter.selectOption("delete_post");
			await expect(entryWith(page, reason)).toHaveCount(0);
			await expect(entries.first()).toHaveAttribute("data-action", "delete_post");
			await expect(entries.and(page.locator(':not([data-action="delete_post"])'))).toHaveCount(0);

			await filter.selectOption("");
			await expect(entryWith(page, reason)).toHaveCount(1);
		});

		test("should search loaded entries", async ({ page }) => {
			const target = await registerUser("audit");
			const reason = uniqueId("Audit search");
			await banUserViaApi(target.id, reason);
			await goToAudit(page);

			const search = page.getByRole("searchbox", { name: /search/i });
			await search.fill(reason);
			await expect(page.getByTestId("audit-entry")).toHaveCount(1);
			await expect(entryWith(page, reason)).toBeVisible();

			await search.fill("no-such-entry-zzz");
			await expect(page.getByTestId("audit-entry")).toHaveCount(0);
			await expect(page.getByTestId("audit-message")).toHaveText(/No loaded entries match/);

			await search.fill("");
			await expect(page.getByTestId("audit-entry").first()).toBeVisible();
		});
	});

	test.describe("Audit Log Pagination", () => {
		test("should page in 50s with Load more", async ({ page }) => {
			const { total } = await fetchAuditLogs({ limit: 1 });
			await goToAudit(page);
			const entries = page.getByTestId("audit-entry");
			const loadMore = page.getByTestId("load-more");

			if (total > PAGE_SIZE) {
				await expect(entries).toHaveCount(PAGE_SIZE);
				await loadMore.click();
				await expect.poll(() => entries.count()).toBeGreaterThan(PAGE_SIZE);
				// Entries logged meanwhile shift offsets; the page must not repeat any
				const ids = await entries.evaluateAll((els) => els.map((el) => el.dataset.id));
				expect(new Set(ids).size).toBe(ids.length);
			} else {
				await expect(loadMore).toHaveCount(0);
				expect(await entries.count()).toBeGreaterThanOrEqual(total);
			}
		});
	});

	test.describe("Accessibility", () => {
		test("should have one h1 and labelled controls", async ({ page }) => {
			await goToAudit(page);
			await expect(page.locator("h1")).toHaveCount(1);
			await expect(page.getByRole("combobox", { name: "Filter by action" })).toBeVisible();
			await expect(page.getByRole("searchbox", { name: /search/i })).toBeVisible();
		});

		test("should label each entry's time with a machine-readable date", async ({ page }) => {
			const target = await registerUser("audit");
			await banUserViaApi(target.id, uniqueId("reason"));
			await goToAudit(page);
			await expect(page.getByTestId("audit-entry").first().locator("time")).toHaveAttribute(
				"datetime",
				/^\d{4}-\d{2}-\d{2}T/,
			);
		});
	});
});
