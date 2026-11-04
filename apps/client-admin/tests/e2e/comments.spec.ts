import { expect, test } from "@playwright/test";
import {
	createComment,
	createPost,
	createReport,
	registerUser,
	seedReportedContent,
} from "./fixtures/content-helpers";
import { commentRow, confirmDelete, openCommentsPage, searchComments } from "./fixtures/content-ui";
import { loginAsAdmin, uniqueId } from "./fixtures/test-helpers";

// Each test seeds its own comments and only deletes those.

test.describe("Comments Management", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test("should display the comments page with search and filter", async ({ page }) => {
		await openCommentsPage(page);
		await expect(page.getByRole("searchbox", { name: "Search comments" })).toBeVisible();
		const filter = page.getByRole("combobox", { name: "Filter comments" });
		await expect(filter.locator("option")).toHaveText([
			"All Comments",
			"Reported Only",
			"Most Recent",
		]);
		await expect(page.locator("tbody tr").first()).toBeVisible();
	});

	test("should list a fresh comment with author, post excerpt and time", async ({ page }) => {
		const postAuthor = await registerUser("cpost");
		const commenter = await registerUser("commenter");
		const post = await createPost(postAuthor, `Parent post ${uniqueId("post")}`);
		const comment = await createComment(commenter, post.id, `Listed ${uniqueId("comment")}`);

		await openCommentsPage(page, comment.content);
		const row = commentRow(page, comment.content);
		await expect(row).toHaveCount(1);
		await expect(row.getByRole("link", { name: commenter.displayName })).toHaveAttribute(
			"href",
			`/users/${commenter.id}`,
		);
		const postLink = row.getByRole("link", { name: post.content.slice(0, 60) });
		await expect(postLink).toHaveAttribute("href", `/posts/${post.id}`);
		await expect(row.locator("time")).toHaveText(/just now|minute/);
		// No pending reports
		await expect(row.getByTitle("Pending reports")).toHaveCount(0);
	});

	test("the post link and the eye button open the parent post", async ({ page }) => {
		const author = await registerUser("cpost");
		const post = await createPost(author, `Eye target ${uniqueId("post")}`);
		const comment = await createComment(author, post.id, `Eye ${uniqueId("comment")}`);

		await openCommentsPage(page, comment.content);
		await commentRow(page, comment.content)
			.getByRole("link", { name: `View post for comment by @${author.username}` })
			.click();
		await expect(page).toHaveURL(`/posts/${post.id}`);
		await expect(page.getByText(comment.content)).toBeVisible();

		await openCommentsPage(page, comment.content);
		await commentRow(page, comment.content)
			.getByRole("link", { name: post.content.slice(0, 60) })
			.click();
		await expect(page).toHaveURL(`/posts/${post.id}`);
		await expect(page.getByRole("heading", { name: "Post Details" })).toBeVisible();
	});

	test("should search by author username", async ({ page }) => {
		const author = await registerUser("csearch");
		const post = await createPost(author);
		const comment = await createComment(author, post.id, `By author ${uniqueId("comment")}`);

		await openCommentsPage(page, author.username);
		await expect(commentRow(page, comment.content)).toBeVisible();
		await expect(page.locator("tbody tr")).toHaveCount(1);
	});

	test("should show a no-results message", async ({ page }) => {
		const query = uniqueId("nothing-matches");
		await openCommentsPage(page, query);
		await expect(page.getByText(`No comments match "${query}"`)).toBeVisible();
		await searchComments(page, "");
		await expect(page.getByText(`No comments match "${query}"`)).toHaveCount(0);
	});

	test("Reported Only shows reported comments and hides unreported ones", async ({ page }) => {
		const tag = uniqueId("cfilter");
		const author = await registerUser("cfilter");
		const reporter = await registerUser("reporter");
		const post = await createPost(author);
		const reported = await createComment(author, post.id, `${tag} reported`);
		const unreported = await createComment(author, post.id, `${tag} unreported`);
		await createReport(reporter, "comment", reported.id, "Harassment");

		await openCommentsPage(page, tag);
		await expect(page.locator("tbody tr")).toHaveCount(2);
		await expect(commentRow(page, reported.content).getByTitle("Pending reports")).toHaveText("1");

		const filter = page.getByRole("combobox", { name: "Filter comments" });
		await filter.selectOption("reported");
		await expect(commentRow(page, unreported.content)).toHaveCount(0);
		await expect(commentRow(page, `${tag} reported`)).toHaveCount(1);

		await filter.selectOption("all");
		await expect(page.locator("tbody tr")).toHaveCount(2);
	});

	test("should require a reason before deleting", async ({ page }) => {
		const { comment, author } = await seedReportedContent("comment");

		await openCommentsPage(page, comment.content);
		await commentRow(page, comment.content)
			.getByRole("button", { name: `Delete comment by @${author.username}` })
			.click();
		const dialog = page.getByRole("dialog", { name: "Delete comment?" });
		await expect(dialog).toContainText(comment.content);
		const confirm = dialog.getByRole("button", { name: "Delete comment", exact: true });
		await expect(confirm).toBeDisabled();
		await dialog.getByRole("textbox", { name: "Reason" }).fill("Abusive");
		await expect(confirm).toBeEnabled();
		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog).toBeHidden();
		await expect(commentRow(page, comment.content)).toBeVisible();
	});

	test("should delete a comment and remove its row", async ({ page }) => {
		const author = await registerUser("cdelete");
		const post = await createPost(author);
		const keep = await createComment(author, post.id, `Keep ${uniqueId("comment")}`);
		const remove = await createComment(author, post.id, `Remove ${uniqueId("comment")}`);

		await openCommentsPage(page, author.username);
		await expect(page.locator("tbody tr")).toHaveCount(2);
		await commentRow(page, remove.content)
			.getByRole("button", { name: `Delete comment by @${author.username}` })
			.click();
		await confirmDelete(page, "comment", "E2E: delete comment");
		await expect(commentRow(page, remove.content)).toHaveCount(0);
		await expect(commentRow(page, keep.content)).toBeVisible();

		// Gone server-side too
		await openCommentsPage(page, author.username);
		await expect(page.locator("tbody tr")).toHaveCount(1);
		await expect(commentRow(page, keep.content)).toBeVisible();
	});
});
