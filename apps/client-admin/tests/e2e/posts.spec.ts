import { expect, test } from "@playwright/test";
import { createComment, createPost, registerUser } from "./fixtures/content-helpers";
import { openPostDetail, openPostsPage, postCard } from "./fixtures/content-ui";
import { loginAsAdmin, uniqueId } from "./fixtures/test-helpers";

test.describe("Posts Management", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test("should display the posts page with search and filter", async ({ page }) => {
		await openPostsPage(page);
		await expect(page.getByRole("searchbox", { name: "Search posts" })).toBeVisible();
		const filter = page.getByRole("combobox", { name: "Filter posts" });
		await expect(filter).toBeVisible();
		await expect(filter.locator("option")).toHaveText([
			"All Posts",
			"Reported Only",
			"Most Recent",
		]);
	});

	test("should list a freshly created post with its author and stats", async ({ page }) => {
		const author = await registerUser("posts");
		const post = await createPost(author, `List check ${uniqueId("post")}`);

		await openPostsPage(page, post.content);
		const card = postCard(page, post.content);
		await expect(card).toHaveCount(1);
		await expect(card.getByRole("link", { name: author.displayName })).toHaveAttribute(
			"href",
			`/users/${author.id}`,
		);
		await expect(card.getByText(`@${author.username}`)).toBeVisible();
		await expect(card.getByTitle("Likes")).toHaveText("0");
		await expect(card.getByTitle("Comments")).toHaveText("0");
		await expect(card.getByText("just now")).toBeVisible();
		// Unreported posts don't show a reports badge
		await expect(card.getByTitle("Pending reports")).toHaveCount(0);
	});

	test("should link to the post detail page", async ({ page }) => {
		const author = await registerUser("posts");
		const post = await createPost(author, `View check ${uniqueId("post")}`);

		await openPostsPage(page, post.content);
		await postCard(page, post.content)
			.getByRole("link", { name: `View post by @${author.username}` })
			.click();
		await expect(page).toHaveURL(`/posts/${post.id}`);
		await expect(page.getByRole("heading", { name: "Post Details" })).toBeVisible();
		await expect(page.getByText(post.content)).toBeVisible();
	});

	test("should have an accessible delete button per post", async ({ page }) => {
		const author = await registerUser("posts");
		const post = await createPost(author, `Delete button ${uniqueId("post")}`);

		await openPostsPage(page, post.content);
		await expect(
			postCard(page, post.content).getByRole("button", {
				name: `Delete post by @${author.username}`,
			}),
		).toBeVisible();
	});
});

test.describe("Post Detail Page", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test("should show the post, author, counts and comments", async ({ page }) => {
		const author = await registerUser("detail");
		const commenter = await registerUser("commenter");
		const post = await createPost(author, `Detail check ${uniqueId("post")}`);
		const comment = await createComment(commenter, post.id, `Detail comment ${uniqueId("c")}`);

		await openPostDetail(page, post.id);
		await expect(page.getByText(post.content)).toBeVisible();
		await expect(page.getByRole("link", { name: author.displayName })).toHaveAttribute(
			"href",
			`/users/${author.id}`,
		);
		await expect(page.getByText("0 likes")).toBeVisible();
		await expect(page.getByText("1 comment", { exact: true })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Reports (0)" })).toBeVisible();
		await expect(page.getByText("No reports for this post")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Comments (1)" })).toBeVisible();
		await expect(page.getByText(comment.content)).toBeVisible();
		await expect(page.getByRole("button", { name: "Delete Post" })).toBeVisible();
	});

	test("should navigate back to the posts list", async ({ page }) => {
		const author = await registerUser("detail");
		const post = await createPost(author, `Back check ${uniqueId("post")}`);

		await openPostDetail(page, post.id);
		await page.getByRole("link", { name: "Back to Posts" }).click();
		await expect(page).toHaveURL("/posts");
	});

	test("should show a not-found state for an unknown post", async ({ page }) => {
		await page.goto("/posts/does-not-exist", { waitUntil: "networkidle" });
		await expect(page.getByRole("heading", { name: "Post not found" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Delete Post" })).toHaveCount(0);
		await expect(page.getByRole("link", { name: "Back to Posts" })).toBeVisible();
	});
});
