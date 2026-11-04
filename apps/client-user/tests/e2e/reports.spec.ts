import { expect, type Page, test } from "@playwright/test";
import { createTweetyClient } from "@tweety/grpc-client";
import { loginAs, uniqueId, waitForHydration } from "./fixtures/test-helpers";

/**
 * Reporting posts, comments and users for moderator review.
 *
 * Every test reports content owned by a throwaway user it registers itself
 * through the API, so reports never collide with seeded data or with tests
 * running in parallel (the API rejects a second pending report on the same
 * target by the same reporter).
 */

const client = createTweetyClient({ host: "localhost:50051" });

interface SeededAuthor {
	email: string;
	password: string;
	username: string;
	userId: string;
	sessionToken: string;
}

async function registerAuthor(): Promise<SeededAuthor> {
	const id = uniqueId("rp")
		.replace(/[^a-z0-9]/gi, "")
		.slice(-14);
	const user = { email: `${id}@example.com`, password: "password123", username: id };
	const { response } = await client.auth.register({
		...user,
		displayName: `Reported ${id}`,
	});
	if (!response.success) throw new Error(`register failed: ${response.error}`);
	return { ...user, userId: response.userId, sessionToken: response.sessionToken };
}

async function seedPost(author: SeededAuthor, content: string): Promise<string> {
	const { response } = await client.posts.createPost({
		sessionToken: author.sessionToken,
		content,
	});
	if (!response.success) throw new Error(`createPost failed: ${response.error}`);
	return response.postId;
}

async function seedComment(author: SeededAuthor, postId: string, content: string) {
	const { response } = await client.comments.createComment({
		sessionToken: author.sessionToken,
		postId,
		content,
	});
	if (!response.success) throw new Error(`createComment failed: ${response.error}`);
	return response.commentId;
}

async function openPost(page: Page, postId: string, content: string) {
	await page.goto(`/posts/${postId}`, { waitUntil: "networkidle" });
	await waitForHydration(page);
	await expect(page.locator("article").filter({ hasText: content })).toBeVisible();
}

/** Pick a reason and submit; returns the dialog locator. */
async function submitReport(page: Page, title: string, reason: string, details?: string) {
	const dialog = page.getByRole("dialog", { name: title });
	await expect(dialog).toBeVisible();
	await dialog.getByRole("radio", { name: reason }).check();
	if (details) await dialog.getByLabel(/Details/).fill(details);
	await dialog.getByRole("button", { name: "Submit report" }).click();
	return dialog;
}

test.describe("Reporting content", () => {
	test("reports another user's post and shows a confirmation", async ({ page }) => {
		const author = await registerAuthor();
		const content = `Reportable post ${uniqueId()}`;
		const postId = await seedPost(author, content);

		await loginAs(page, "alice");
		await openPost(page, postId, content);

		const post = page.locator("article").filter({ hasText: content });
		await post.getByRole("button", { name: "Report post" }).click();

		const dialog = page.getByRole("dialog", { name: "Report post" });
		await expect(dialog).toBeVisible();
		// Submit is disabled until a reason is chosen
		await expect(dialog.getByRole("button", { name: "Submit report" })).toBeDisabled();
		for (const reason of [
			"Spam",
			"Harassment or bullying",
			"Hate speech",
			"Misinformation",
			"Violence or threats",
			"Other",
		]) {
			await expect(dialog.getByRole("radio", { name: reason })).toBeVisible();
		}

		await submitReport(page, "Report post", "Spam", "Selling things in every thread");
		await expect(dialog.getByText("Thanks — a moderator will review this.")).toBeVisible();

		await dialog.getByRole("button", { name: "Done" }).click();
		await expect(dialog).not.toBeVisible();
	});

	test("shows an error when reporting the same post twice", async ({ page }) => {
		const author = await registerAuthor();
		const content = `Twice reported ${uniqueId()}`;
		const postId = await seedPost(author, content);

		await loginAs(page, "alice");
		await openPost(page, postId, content);

		const reportButton = page.getByRole("button", { name: "Report post" });
		await reportButton.click();
		const dialog = await submitReport(page, "Report post", "Misinformation");
		await expect(dialog.getByText("Thanks — a moderator will review this.")).toBeVisible();
		await dialog.getByRole("button", { name: "Done" }).click();
		await expect(dialog).not.toBeVisible();

		await reportButton.click();
		await submitReport(page, "Report post", "Other");
		await expect(dialog.getByRole("alert")).toHaveText(/already reported this/i);
		// The form stays open so the user can cancel
		await expect(dialog.getByRole("button", { name: "Submit report" })).toBeVisible();
		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog).not.toBeVisible();
	});

	test("Escape closes the dialog without submitting", async ({ page }) => {
		const author = await registerAuthor();
		const content = `Escape post ${uniqueId()}`;
		const postId = await seedPost(author, content);

		await loginAs(page, "alice");
		await openPost(page, postId, content);

		await page.getByRole("button", { name: "Report post" }).click();
		const dialog = page.getByRole("dialog", { name: "Report post" });
		await expect(dialog).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(dialog).not.toBeVisible();

		// Nothing was submitted, so a real report still succeeds afterwards
		await page.getByRole("button", { name: "Report post" }).click();
		await submitReport(page, "Report post", "Spam");
		await expect(dialog.getByText("Thanks — a moderator will review this.")).toBeVisible();
	});

	test("does not show a Report button on your own post", async ({ page }) => {
		const author = await registerAuthor();
		const content = `My own post ${uniqueId()}`;
		const postId = await seedPost(author, content);

		await loginAs(page, { email: author.email, password: author.password });
		await openPost(page, postId, content);

		const post = page.locator("article").filter({ hasText: content });
		// Owner controls are there, so the card has rendered for its owner
		await expect(post.getByRole("button", { name: "Delete post" })).toBeVisible();
		await expect(post.getByRole("button", { name: "Report post" })).toHaveCount(0);
	});

	test("does not show Report buttons when logged out", async ({ page }) => {
		const author = await registerAuthor();
		const content = `Logged out view ${uniqueId()}`;
		const postId = await seedPost(author, content);
		const comment = `Logged out comment ${uniqueId()}`;
		await seedComment(author, postId, comment);

		await openPost(page, postId, content);
		await expect(page.locator("p", { hasText: comment })).toBeVisible();
		await expect(page.getByText("to leave a comment")).toBeVisible();

		await expect(page.getByRole("button", { name: "Report post" })).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Report comment" })).toHaveCount(0);
	});

	test("reports another user's comment", async ({ page }) => {
		const author = await registerAuthor();
		const content = `Post with comment ${uniqueId()}`;
		const postId = await seedPost(author, content);
		const comment = `Rude comment ${uniqueId()}`;
		await seedComment(author, postId, comment);

		await loginAs(page, "alice");
		await openPost(page, postId, content);

		// not getByText: that would also match the comment textarea's value
		const commentRow = page
			.locator("p", { hasText: comment })
			.locator("xpath=ancestor::div[.//button[@aria-pressed]][1]");
		await commentRow.getByRole("button", { name: "Report comment" }).click();

		const dialog = await submitReport(page, "Report comment", "Harassment or bullying");
		await expect(dialog.getByText("Thanks — a moderator will review this.")).toBeVisible();
	});

	test("does not show a Report button on your own comment", async ({ page }) => {
		const author = await registerAuthor();
		const content = `Post for own comment ${uniqueId()}`;
		const postId = await seedPost(author, content);
		const comment = `My own comment ${uniqueId()}`;
		await seedComment(author, postId, comment);

		await loginAs(page, { email: author.email, password: author.password });
		await openPost(page, postId, content);

		const commentRow = page
			.locator("p", { hasText: comment })
			.locator("xpath=ancestor::div[.//button[@aria-pressed]][1]");
		await expect(commentRow.getByRole("button", { name: "Delete comment" })).toBeVisible();
		await expect(commentRow.getByRole("button", { name: "Report comment" })).toHaveCount(0);
	});

	test("reports another user from their profile", async ({ page }) => {
		const author = await registerAuthor();

		await loginAs(page, "alice");
		await page.goto(`/users/${author.username}`, { waitUntil: "networkidle" });
		await waitForHydration(page);
		await expect(page.getByRole("heading", { name: `Reported ${author.username}` })).toBeVisible();

		await page.getByRole("button", { name: "Report user" }).click();
		const dialog = await submitReport(page, "Report user", "Spam");
		await expect(dialog.getByText("Thanks — a moderator will review this.")).toBeVisible();
	});

	test("does not show Report user on your own profile", async ({ page }) => {
		const author = await registerAuthor();

		await loginAs(page, { email: author.email, password: author.password });
		await page.goto(`/users/${author.username}`, { waitUntil: "networkidle" });
		await waitForHydration(page);
		await expect(page.getByRole("heading", { name: `Reported ${author.username}` })).toBeVisible();
		await expect(page.getByRole("button", { name: "Report user" })).toHaveCount(0);
	});
});
