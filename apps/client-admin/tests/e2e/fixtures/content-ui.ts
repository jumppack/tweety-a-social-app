import { expect, type Locator, type Page } from "@playwright/test";
import { waitForHydration } from "./test-helpers";

/**
 * Page helpers for the Posts and Comments admin pages. Tests find their own
 * seeded rows by searching for unique content, so they never depend on (or
 * touch) content other tests or agents created.
 */

export async function openPostsPage(page: Page, search?: string) {
	await page.goto("/posts", { waitUntil: "networkidle" });
	await waitForHydration(page);
	await expect(page.getByRole("heading", { name: "Posts", exact: true })).toBeVisible();
	if (search) await searchPosts(page, search);
}

export async function searchPosts(page: Page, query: string) {
	await page.getByRole("searchbox", { name: "Search posts" }).fill(query);
}

export async function openCommentsPage(page: Page, search?: string) {
	await page.goto("/comments", { waitUntil: "networkidle" });
	await waitForHydration(page);
	await expect(page.getByRole("heading", { name: "Comments", exact: true })).toBeVisible();
	if (search) await searchComments(page, search);
}

export async function searchComments(page: Page, query: string) {
	await page.getByRole("searchbox", { name: "Search comments" }).fill(query);
}

export async function openPostDetail(page: Page, postId: string) {
	await page.goto(`/posts/${postId}`, { waitUntil: "networkidle" });
	await waitForHydration(page);
	await expect(page.getByRole("heading", { name: "Post Details" })).toBeVisible();
}

/** The post card on /posts whose content contains `text`. */
export function postCard(page: Page, text: string): Locator {
	return page.locator("article").filter({ hasText: text });
}

/** The table row on /comments whose comment contains `text`. */
export function commentRow(page: Page, text: string): Locator {
	return page.locator("tbody tr").filter({ hasText: text });
}

/** Fill in the reason and confirm; resolves once the dialog has closed (server confirmed). */
export async function confirmDelete(page: Page, kind: "post" | "comment", reason: string) {
	const dialog = page.getByRole("dialog", { name: `Delete ${kind}?` });
	await expect(dialog).toBeVisible();
	await dialog.getByRole("textbox", { name: "Reason" }).fill(reason);
	await dialog.getByRole("button", { name: `Delete ${kind}`, exact: true }).click();
	await expect(dialog).toBeHidden();
}
