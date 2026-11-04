import { expect, test } from "@playwright/test";
import {
	createComment,
	createPost,
	createReport,
	registerUser,
	seedReportedContent,
} from "./fixtures/content-helpers";
import {
	confirmDelete,
	openPostDetail,
	openPostsPage,
	postCard,
	searchPosts,
} from "./fixtures/content-ui";
import { loginAsAdmin, uniqueId } from "./fixtures/test-helpers";

// Every test seeds its own posts (unique content) and only deletes those, so
// tests can run in parallel with each other and with other suites.

test.describe("Posts Management - Comprehensive", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test.describe("Posts List Page", () => {
		test("should show posts newest first", async ({ page }) => {
			const tag = uniqueId("order");
			const author = await registerUser("order");
			const older = await createPost(author, `${tag} older`);
			const newer = await createPost(author, `${tag} newer`);

			await openPostsPage(page, tag);
			const cards = page.locator("article");
			await expect(cards).toHaveCount(2);
			await expect(cards.nth(0)).toContainText(newer.content);
			await expect(cards.nth(1)).toContainText(older.content);
			await expect(page.getByText("Showing 2 of 2")).toBeVisible();
		});

		test("should show like and comment counts and a relative time", async ({ page }) => {
			const author = await registerUser("stats");
			const commenter = await registerUser("stats");
			const post = await createPost(author, `Stats ${uniqueId("post")}`);
			await createComment(commenter, post.id);
			await createComment(commenter, post.id);

			await openPostsPage(page, post.content);
			const card = postCard(page, post.content);
			await expect(card.getByTitle("Comments")).toHaveText("2");
			await expect(card.getByTitle("Likes")).toHaveText("0");
			await expect(card.locator("time")).toHaveText(/just now|minute/);
		});

		test("should show a reports badge only on reported posts", async ({ page }) => {
			const { post } = await seedReportedContent("post");
			const extraReporter = await registerUser("reporter");
			await createReport(extraReporter, "post", post.id, "Harassment");
			const author = await registerUser("clean");
			const clean = await createPost(author, `Clean ${uniqueId("post")}`);

			await openPostsPage(page, post.content);
			await expect(postCard(page, post.content).getByTitle("Pending reports")).toHaveText(
				"2 reports",
			);

			await searchPosts(page, clean.content);
			await expect(postCard(page, clean.content)).toBeVisible();
			await expect(postCard(page, clean.content).getByTitle("Pending reports")).toHaveCount(0);
		});

		test("should navigate to the author's profile", async ({ page }) => {
			const author = await registerUser("profile");
			const post = await createPost(author, `Profile ${uniqueId("post")}`);

			await openPostsPage(page, post.content);
			await postCard(page, post.content).getByRole("link", { name: author.displayName }).click();
			await expect(page).toHaveURL(`/users/${author.id}`);
			await expect(page.getByText(`@${author.username}`).first()).toBeVisible();
		});

		test("should page with Load more when there are more posts than fit", async ({ page }) => {
			const tag = uniqueId("paging");
			const author = await registerUser("paging");
			for (let i = 0; i < 21; i++) {
				await createPost(author, `${tag} #${i}`);
			}

			await openPostsPage(page, tag);
			await expect(page.locator("article")).toHaveCount(20);
			await expect(page.getByText("Showing 20 of 21")).toBeVisible();
			await page.getByRole("button", { name: "Load more" }).click();
			await expect(page.locator("article")).toHaveCount(21);
			await expect(page.getByText("Showing 21 of 21")).toBeVisible();
			await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
			// The oldest post comes last
			await expect(page.locator("article").last()).toContainText(`${tag} #0`);
		});
	});

	test.describe("Post Search and Filter", () => {
		test("should search by content", async ({ page }) => {
			const author = await registerUser("search");
			const post = await createPost(author, `Searchable ${uniqueId("content")}`);

			await openPostsPage(page, post.content);
			await expect(page.locator("article")).toHaveCount(1);
			await expect(postCard(page, post.content)).toBeVisible();
		});

		test("should search by author username", async ({ page }) => {
			const author = await registerUser("byauthor");
			const post = await createPost(author, `By author ${uniqueId("post")}`);

			await openPostsPage(page, author.username);
			await expect(postCard(page, post.content)).toBeVisible();
			await expect(page.locator("article")).toHaveCount(1);
		});

		test("should show a no-results message", async ({ page }) => {
			const query = uniqueId("nothing-matches");
			await openPostsPage(page, query);
			await expect(page.getByText(`No posts match "${query}"`)).toBeVisible();
			await expect(page.locator("article")).toHaveCount(0);
		});

		test("should restore the list when the search is cleared", async ({ page }) => {
			const query = uniqueId("nothing-matches");
			await openPostsPage(page, query);
			await expect(page.getByText(`No posts match "${query}"`)).toBeVisible();
			await searchPosts(page, "");
			await expect(page.locator("article").first()).toBeVisible();
		});

		test("Reported Only shows reported posts and hides unreported ones", async ({ page }) => {
			const tag = uniqueId("filter");
			const author = await registerUser("filter");
			const reporter = await registerUser("reporter");
			const reported = await createPost(author, `${tag} reported`);
			const unreported = await createPost(author, `${tag} unreported`);
			await createReport(reporter, "post", reported.id, "Spam");

			await openPostsPage(page, tag);
			await expect(page.locator("article")).toHaveCount(2);

			const filter = page.getByRole("combobox", { name: "Filter posts" });
			await filter.selectOption("reported");
			await expect(postCard(page, unreported.content)).toHaveCount(0);
			await expect(postCard(page, `${tag} reported`)).toHaveCount(1);

			await filter.selectOption("all");
			await expect(page.locator("article")).toHaveCount(2);

			// "Most Recent" is the default newest-first order, unfiltered
			await filter.selectOption("recent");
			await expect(page.locator("article")).toHaveCount(2);
			await expect(page.locator("article").first()).toContainText(unreported.content);
		});

		test("should show an empty state when nothing reported matches", async ({ page }) => {
			const author = await registerUser("noreport");
			const post = await createPost(author, `Unreported ${uniqueId("post")}`);

			await openPostsPage(page, post.content);
			await expect(postCard(page, post.content)).toBeVisible();
			await page.getByRole("combobox", { name: "Filter posts" }).selectOption("reported");
			await expect(page.getByText(`No posts match "${post.content}"`)).toBeVisible();
		});
	});

	test.describe("Post Detail Page", () => {
		test("should show the post's reports with reason, reporter, description and status", async ({
			page,
		}) => {
			const reason = "Misleading content";
			const { post, reporter, author } = await seedReportedContent("post", reason);

			await openPostDetail(page, post.id);
			await expect(page.getByText(post.content)).toBeVisible();
			await expect(page.getByText("1 pending report")).toBeVisible();
			await expect(page.getByRole("heading", { name: "Reports (1)" })).toBeVisible();

			const reports = page.getByRole("region", { name: /Reports/ });
			await expect(reports.getByText(reason)).toBeVisible();
			await expect(reports.getByText(`Reported by @${reporter.username}`)).toBeVisible();
			await expect(reports.getByText(/^Details /)).toBeVisible();
			await expect(reports.getByText("pending", { exact: true })).toBeVisible();
			await expect(reports.locator("time")).toHaveText(/just now|minute/);

			await expect(page.getByRole("link", { name: author.displayName }).first()).toHaveAttribute(
				"href",
				`/users/${author.id}`,
			);
		});

		test("should show comments with their authors", async ({ page }) => {
			const { post, comment, author } = await seedReportedContent("comment");

			await openPostDetail(page, post.id);
			const comments = page.getByRole("region", { name: /Comments/ });
			await expect(page.getByRole("heading", { name: "Comments (1)" })).toBeVisible();
			await expect(comments.getByText(comment.content)).toBeVisible();
			await expect(comments.getByRole("link", { name: author.displayName })).toBeVisible();
			await expect(comments.getByText(`@${author.username}`)).toBeVisible();
			// The comment's own pending report is flagged
			await expect(comments.getByTitle("Pending reports")).toHaveText("1");
		});

		test("should show empty states when a post has no reports or comments", async ({ page }) => {
			const author = await registerUser("empty");
			const post = await createPost(author, `Empty ${uniqueId("post")}`);

			await openPostDetail(page, post.id);
			await expect(page.getByText("No reports for this post")).toBeVisible();
			await expect(page.getByText("No comments on this post")).toBeVisible();
		});

		test("should show a not-found state with a link back", async ({ page }) => {
			await page.goto(`/posts/${uniqueId("missing")}`, { waitUntil: "networkidle" });
			await expect(page.getByRole("heading", { name: "Post not found" })).toBeVisible();
			await page.getByRole("link", { name: "Back to Posts" }).click();
			await expect(page).toHaveURL("/posts");
		});
	});

	test.describe("Post Deletion", () => {
		test("should require a reason before deleting", async ({ page }) => {
			const author = await registerUser("reason");
			const post = await createPost(author, `Needs reason ${uniqueId("post")}`);

			await openPostsPage(page, post.content);
			await postCard(page, post.content)
				.getByRole("button", { name: `Delete post by @${author.username}` })
				.click();

			const dialog = page.getByRole("dialog", { name: "Delete post?" });
			await expect(dialog).toContainText(post.content);
			const confirm = dialog.getByRole("button", { name: "Delete post", exact: true });
			await expect(confirm).toBeDisabled();
			await dialog.getByRole("textbox", { name: "Reason" }).fill("   ");
			await expect(confirm).toBeDisabled();
			await dialog.getByRole("textbox", { name: "Reason" }).fill("Spam");
			await expect(confirm).toBeEnabled();
		});

		test("should keep the post when deletion is cancelled", async ({ page }) => {
			const author = await registerUser("cancel");
			const post = await createPost(author, `Cancel delete ${uniqueId("post")}`);

			await openPostsPage(page, post.content);
			await postCard(page, post.content)
				.getByRole("button", { name: `Delete post by @${author.username}` })
				.click();
			const dialog = page.getByRole("dialog", { name: "Delete post?" });
			await dialog.getByRole("button", { name: "Cancel" }).click();
			await expect(dialog).toBeHidden();
			await expect(postCard(page, post.content)).toBeVisible();

			// Still there after a reload
			await openPostsPage(page, post.content);
			await expect(postCard(page, post.content)).toBeVisible();
		});

		test("should delete a post from the list", async ({ page }) => {
			const author = await registerUser("dellist");
			const post = await createPost(author, `Delete from list ${uniqueId("post")}`);

			await openPostsPage(page, post.content);
			await postCard(page, post.content)
				.getByRole("button", { name: `Delete post by @${author.username}` })
				.click();
			await confirmDelete(page, "post", "E2E: delete from list");
			await expect(postCard(page, post.content)).toHaveCount(0);

			// Gone server-side too
			await openPostsPage(page, post.content);
			await expect(page.getByText(`No posts match "${post.content}"`)).toBeVisible();
		});

		test("should delete a post from the detail page and return to the list", async ({ page }) => {
			const author = await registerUser("deldetail");
			const post = await createPost(author, `Delete from detail ${uniqueId("post")}`);

			await openPostDetail(page, post.id);
			await page.getByRole("button", { name: "Delete Post" }).click();
			await confirmDelete(page, "post", "E2E: delete from detail");
			await expect(page).toHaveURL("/posts");
			await expect(page.getByRole("heading", { name: "Posts", exact: true })).toBeVisible();

			await openPostDetail(page, post.id);
			await expect(page.getByRole("heading", { name: "Post not found" })).toBeVisible();
		});

		test("should delete a comment from the post detail page", async ({ page }) => {
			const author = await registerUser("delcomment");
			const post = await createPost(author, `Comment delete ${uniqueId("post")}`);
			const keep = await createComment(author, post.id, `Keep me ${uniqueId("c")}`);
			const remove = await createComment(author, post.id, `Remove me ${uniqueId("c")}`);

			await openPostDetail(page, post.id);
			await expect(page.getByRole("heading", { name: "Comments (2)" })).toBeVisible();
			await page
				.locator(`[data-comment-id="${remove.id}"]`)
				.getByRole("button", { name: `Delete comment by @${author.username}` })
				.click();
			await confirmDelete(page, "comment", "E2E: delete comment");

			await expect(page.getByText(remove.content)).toHaveCount(0);
			await expect(page.getByText(keep.content)).toBeVisible();
			await expect(page.getByRole("heading", { name: "Comments (1)" })).toBeVisible();

			await openPostDetail(page, post.id);
			await expect(page.getByText(remove.content)).toHaveCount(0);
			await expect(page.getByText(keep.content)).toBeVisible();
		});
	});

	test.describe("Accessibility", () => {
		test("should have a single h1 on the posts list", async ({ page }) => {
			await openPostsPage(page);
			await expect(page.getByRole("heading", { level: 1 })).toHaveText("Posts");
		});

		test("should label the search box and filter", async ({ page }) => {
			await openPostsPage(page);
			await expect(page.getByRole("searchbox", { name: "Search posts" })).toBeVisible();
			await expect(page.getByRole("combobox", { name: "Filter posts" })).toBeVisible();
		});

		test("should give icon buttons accessible names", async ({ page }) => {
			const author = await registerUser("a11y");
			const post = await createPost(author, `A11y ${uniqueId("post")}`);

			await openPostsPage(page, post.content);
			const card = postCard(page, post.content);
			await expect(
				card.getByRole("link", { name: `View post by @${author.username}` }),
			).toHaveAttribute("title", "View post");
			await expect(
				card.getByRole("button", { name: `Delete post by @${author.username}` }),
			).toHaveAttribute("title", "Delete post");
		});

		test("should close the delete dialog with Escape", async ({ page }) => {
			const author = await registerUser("a11y");
			const post = await createPost(author, `Escape ${uniqueId("post")}`);

			await openPostsPage(page, post.content);
			await postCard(page, post.content)
				.getByRole("button", { name: `Delete post by @${author.username}` })
				.click();
			await expect(page.getByRole("dialog", { name: "Delete post?" })).toBeVisible();
			await page.keyboard.press("Escape");
			await expect(page.getByRole("dialog")).toHaveCount(0);
			await expect(postCard(page, post.content)).toBeVisible();
		});
	});
});
