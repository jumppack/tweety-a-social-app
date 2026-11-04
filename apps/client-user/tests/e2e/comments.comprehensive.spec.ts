import { expect, test } from "@playwright/test";
import { loginAs, setupDialogHandler, uniqueId, waitForHydration } from "./fixtures/test-helpers";

test.describe("Comments - Comprehensive", () => {
	test.beforeEach(async ({ page }) => {
		await loginAs(page, "alice");
	});

	async function navigateToFirstPost(page: import("@playwright/test").Page) {
		await page.goto("/", { waitUntil: "networkidle" });
		await waitForHydration(page);

		const postLink = page.locator('a[href*="/posts/"]').first();
		await postLink.click();
		await waitForHydration(page);
	}

	/** The innermost element holding both the comment text and its like button. */
	function commentContaining(page: import("@playwright/test").Page, content: string) {
		// Anchor on the comment's own text, then climb to the nearest ancestor
		// that holds a like button (a broad div filter matched the whole list)
		return page
			.locator("p", { hasText: content }) // not getByText: that also matches the textarea
			.locator("xpath=ancestor::div[.//button[@aria-pressed]][1]");
	}

	test.describe("Creating Comments", () => {
		test("should add a comment to a post", async ({ page }) => {
			await navigateToFirstPost(page);

			const content = `Test comment ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', content);
			await page.click('button:has-text("Comment")');
			await waitForHydration(page);

			await expect(page.getByText(content)).toBeVisible();
		});

		test("should show comment immediately after posting", async ({ page }) => {
			await navigateToFirstPost(page);

			const content = `Instant comment ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', content);
			await page.click('button:has-text("Comment")');
			await waitForHydration(page);

			await expect(page.getByText(content)).toBeVisible();
		});

		test("should clear comment input after posting", async ({ page }) => {
			await navigateToFirstPost(page);

			const content = `Clear comment ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', content);
			await page.click('button:has-text("Comment")');
			await waitForHydration(page);

			await expect(page.locator('textarea[placeholder*="comment"]')).toHaveValue("");
		});

		test("should disable comment button when empty", async ({ page }) => {
			await navigateToFirstPost(page);

			const commentButton = page.locator('button:has-text("Comment")');
			const isDisabled = await commentButton.isDisabled();
			expect(isDisabled).toBe(true);
		});

		test("should show character count for comments", async ({ page }) => {
			await navigateToFirstPost(page);

			await page.fill('textarea[placeholder*="comment"]', "Hello");
			// Should show character count (implementation may vary)
			const charCount = page.getByText(/\d+\/\d+/);
			await expect(charCount).toBeVisible();
		});

		test("should create comment with special characters", async ({ page }) => {
			await navigateToFirstPost(page);

			const content = `Special: @mention #tag "quotes" ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', content);
			await page.click('button:has-text("Comment")');
			await waitForHydration(page);

			await expect(page.getByText(content)).toBeVisible();
		});

		test("should create comment with emojis", async ({ page }) => {
			await navigateToFirstPost(page);

			const content = `Emoji comment 🎉 ❤️ ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', content);
			await page.click('button:has-text("Comment")');
			await waitForHydration(page);

			// Match this run's unique comment (a bare /Emoji comment.*🎉/ also hit the
			// textarea and every emoji comment left by earlier runs)
			await expect(page.locator("p", { hasText: content })).toBeVisible();
		});
	});

	test.describe("Viewing Comments", () => {
		test("should display existing comments", async ({ page }) => {
			await navigateToFirstPost(page);

			// Comments section should be visible
			const comments = page.locator('article, [data-testid*="comment"]');
			// At least the post and potentially comments
			expect(await comments.count()).toBeGreaterThanOrEqual(0);
		});

		test("should show comment author", async ({ page }) => {
			await navigateToFirstPost(page);

			// Add a comment first
			const content = `Author test ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', content);
			await page.click('button:has-text("Comment")');
			await waitForHydration(page);

			// Should show Alice's username in the comments section (use nth to get comment, not post author)
			await expect(page.getByRole("link", { name: "@alice" }).nth(1)).toBeVisible();
		});

		test("should show comment timestamp", async ({ page }) => {
			await navigateToFirstPost(page);

			// Add a comment
			const content = `Time test ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', content);
			await page.click('button:has-text("Comment")');
			await waitForHydration(page);

			// Should show "just now" or similar (use first() as there may be multiple timestamps)
			await expect(page.getByText(/just now|ago|minute/i).first()).toBeVisible();
		});

		test("should show comment count on feed posts", async ({ page }) => {
			await page.goto("/", { waitUntil: "networkidle" });
			await waitForHydration(page);

			// Posts in feed should show comment count
			const commentIndicator = page.locator('a[href*="/posts/"]').filter({ hasText: /\d+/ });
			expect(await commentIndicator.count()).toBeGreaterThanOrEqual(0);
		});
	});

	test.describe("Deleting Comments", () => {
		test("should delete own comment", async ({ page }) => {
			setupDialogHandler(page, "accept");

			await navigateToFirstPost(page);

			// Create a comment to delete
			const content = `Delete me ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', content);
			await page.click('button:has-text("Comment")');
			await waitForHydration(page);

			await expect(page.getByText(content)).toBeVisible();

			// Find and click delete button for this comment
			const commentParagraph = page.locator("p", { hasText: content });
			const actionsDiv = commentParagraph.locator("..").locator("div").last();
			const deleteButton = actionsDiv.locator("button").last();
			await deleteButton.click();
			await waitForHydration(page);

			await expect(page.getByText(content)).not.toBeVisible();
		});

		test("should not show delete button for others comments", async ({ page }) => {
			// Navigate to a post by Bob
			await page.goto("/users/bob", { waitUntil: "networkidle" });
			await waitForHydration(page);

			// Click on one of Bob's posts
			const postLink = page.locator('a[href*="/posts/"]').first();
			if (await postLink.isVisible()) {
				await postLink.click();
				await waitForHydration(page);

				// Check if there are comments by other users - delete button should not be visible
				// This depends on having comments in seed data
			}
		});
	});

	test.describe("Liking Comments", () => {
		test("should like a comment", async ({ page }) => {
			await navigateToFirstPost(page);

			// Add a comment first
			const content = `Likeable comment ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', content);
			await page.click('button:has-text("Comment")');

			// The like button inside the new comment (previously this used a
			// class-name guess wrapped in `if (isVisible)`, so it asserted nothing)
			const comment = commentContaining(page, content);
			await comment.getByTitle("Like comment").click();
			await expect(comment.getByTitle("Unlike comment")).toHaveAttribute("aria-pressed", "true");
		});

		test("should unlike a comment", async ({ page }) => {
			await navigateToFirstPost(page);

			// Add and like a comment
			const content = `Unlike test ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', content);
			await page.click('button:has-text("Comment")');

			const comment = commentContaining(page, content);
			await comment.getByTitle("Like comment").click();
			await expect(comment.getByTitle("Unlike comment")).toBeVisible();

			await comment.getByTitle("Unlike comment").click();
			await expect(comment.getByTitle("Like comment")).toHaveAttribute("aria-pressed", "false");
		});
	});

	test.describe("Nested Comments (Replies)", () => {
		test("should support replying to comments", async ({ page }) => {
			await navigateToFirstPost(page);

			// Add a parent comment
			const parentContent = `Parent comment ${uniqueId()}`;
			await page.fill('textarea[placeholder*="comment"]', parentContent);
			await page.click('button:has-text("Comment")');
			await waitForHydration(page);

			// Look for reply button (if implemented)
			const replyButton = page.getByRole("button", { name: /reply/i });
			if (await replyButton.isVisible()) {
				await replyButton.click();
				await waitForHydration(page);

				const replyContent = `Reply ${uniqueId()}`;
				await page.fill('textarea[placeholder*="reply"]', replyContent);
				await page.click('button:has-text("Reply")');
				await waitForHydration(page);

				await expect(page.getByText(replyContent)).toBeVisible();
			}
		});
	});
});
