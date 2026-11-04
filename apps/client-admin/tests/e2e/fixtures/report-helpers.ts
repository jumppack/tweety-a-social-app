import { expect, type Locator, type Page } from "@playwright/test";
import { createTweetyClient } from "@tweety/grpc-client";
import {
	createComment,
	createPost,
	createReport,
	registerUser,
	type SeedUser,
} from "./content-helpers";
import { ADMIN_USERS, waitForHydration } from "./test-helpers";

/**
 * Helpers for the Reports page specs. Every test seeds its own throwaway
 * author, reporter and content, then finds its report card by a unique
 * description, because other specs (and other agents) add reports to the
 * same database concurrently.
 */

const client = () => createTweetyClient({ host: process.env.GRPC_API_HOST || "localhost:50051" });

function shortId() {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export type ReportTarget = "post" | "comment" | "user";

export interface SeededReport {
	author: SeedUser;
	reporter: SeedUser;
	post: { id: string; content: string };
	comment: { id: string; content: string };
	report: { id: string };
	reason: string;
	description: string;
	/** Text the card shows as the reported content preview. */
	preview: string;
}

export async function seedReport(
	target: ReportTarget = "post",
	reason = "Spam or misleading",
): Promise<SeededReport> {
	const author = await registerUser("author");
	const reporter = await registerUser("reporter");
	const post = await createPost(author, `Reported post ${shortId()}`);
	const comment = await createComment(author, post.id, `Reported comment ${shortId()}`);
	const targetId = target === "post" ? post.id : target === "comment" ? comment.id : author.id;
	const description = `E2E report ${shortId()}`;
	const report = await createReport(reporter, target, targetId, reason, description);
	const preview =
		target === "post"
			? post.content
			: target === "comment"
				? comment.content
				: `${author.displayName} (@${author.username})`;
	return { author, reporter, post, comment, report, reason, description, preview };
}

/** A real admin session for checking results straight through the API. */
export async function apiSession(user: keyof typeof ADMIN_USERS = "admin") {
	const { email, password } = ADMIN_USERS[user];
	const { response } = await client().auth.login({ email, password });
	if (!response.success) throw new Error(`login failed: ${response.error}`);
	return { sessionToken: response.sessionToken, userId: response.userId };
}

export async function postExists(postId: string): Promise<boolean> {
	try {
		await client().posts.getPost({ postId });
		return true;
	} catch {
		return false;
	}
}

export async function commentIds(postId: string): Promise<string[]> {
	const { response } = await client().comments.getPostComments({ postId });
	return response.comments.map((c) => c.id);
}

export async function deletePostAsAuthor(author: SeedUser, postId: string) {
	const { response } = await client().posts.deletePost({
		sessionToken: author.sessionToken,
		postId,
	});
	if (!response.success) throw new Error(`deletePost failed: ${response.error}`);
}

export async function getUserBannedAt(userId: string) {
	const { sessionToken } = await apiSession();
	const { response } = await client().admin.getUserDetails({ sessionToken, userId });
	return response.user?.bannedAt ?? null;
}

export async function getReportStatus(reportId: string) {
	const { sessionToken } = await apiSession();
	const { response } = await client().admin.getReport({ sessionToken, reportId });
	return response.status;
}

export async function reviewReportViaApi(
	reportId: string,
	action: "dismiss" | "remove_content" | "ban_user",
) {
	const { sessionToken } = await apiSession();
	const { response } = await client().admin.reviewReport({ sessionToken, reportId, action });
	if (!response.success) throw new Error(`reviewReport failed: ${response.error}`);
}

export async function findAuditLog(action: string, targetId: string) {
	const { sessionToken } = await apiSession();
	const { response } = await client().admin.getAuditLogs({
		sessionToken,
		pagination: { limit: 100, offset: 0 },
		actionFilter: action,
	});
	return response.logs.find((log) => log.targetId === targetId) ?? null;
}

export async function openReports(page: Page, query = "") {
	await page.goto(`/reports${query}`, { waitUntil: "networkidle" });
	await waitForHydration(page);
	await expect(page.getByText("Loading reports…")).toBeHidden();
}

/** The card for one seeded report, wherever it sits in the list. */
export function reportCard(page: Page, seeded: Pick<SeededReport, "description">): Locator {
	return page.locator("article").filter({ hasText: seeded.description });
}

export function statusTab(page: Page, name: "Pending" | "Resolved" | "Dismissed" | "All") {
	return page.getByRole("tab", { name: new RegExp(`^${name}\\b`) });
}

/** The number in a tab label such as "Dismissed (12)". */
export async function tabCount(page: Page, name: "Pending" | "Resolved" | "Dismissed" | "All") {
	const tab = statusTab(page, name);
	await expect(tab).toHaveText(/\(\d+\)/);
	const text = (await tab.textContent()) ?? "";
	return Number(text.match(/\((\d+)\)/)?.[1] ?? Number.NaN);
}

export async function switchTab(page: Page, name: "Pending" | "Resolved" | "Dismissed" | "All") {
	await statusTab(page, name).click();
	await expect(statusTab(page, name)).toHaveAttribute("aria-selected", "true");
	await expect(page.getByText("Loading reports…")).toBeHidden();
}

/** Opens the confirm dialog for an action on a card, adds notes and confirms. */
export async function reviewFromCard(
	page: Page,
	card: Locator,
	button: RegExp,
	confirm: RegExp,
	notes?: string,
) {
	await card.getByRole("button", { name: button }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	if (notes) await dialog.getByLabel("Notes (optional)").fill(notes);
	await dialog.getByRole("button", { name: confirm }).click();
	return dialog;
}
