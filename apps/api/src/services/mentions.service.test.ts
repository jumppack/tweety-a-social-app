import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestPost, createTestUser } from "../../tests/helpers";
import { db, schema } from "../db";
import { extractMentions, processMentions, validateMentionedUsers } from "./mentions.service";

const { notifications } = schema;

async function mentionNotificationsFor(userId: string) {
	return db
		.select()
		.from(notifications)
		.where(and(eq(notifications.userId, userId), eq(notifications.type, "mention")));
}

describe("MentionsService", () => {
	describe("extractMentions", () => {
		it("returns unique usernames without the @", () => {
			expect(extractMentions("hi @alice and @bob_2, also @alice again")).toEqual([
				"alice",
				"bob_2",
			]);
		});

		it("returns an empty list when there are no mentions", () => {
			expect(extractMentions("no mentions here, email me at x@")).toEqual([]);
		});
	});

	describe("validateMentionedUsers", () => {
		it("maps only usernames that exist", async () => {
			const user = await createTestUser({ username: "realuser" });
			const result = await validateMentionedUsers(["realuser", "ghost"]);
			expect([...result.entries()]).toEqual([["realuser", user.id]]);
		});

		it("returns an empty map for an empty list", async () => {
			expect((await validateMentionedUsers([])).size).toBe(0);
		});
	});

	describe("processMentions", () => {
		it("notifies each mentioned user once and skips unknown usernames", async () => {
			const actor = await createTestUser();
			const target = await createTestUser({ username: "target" });
			const postId = await createTestPost(actor.id, "hey @target @target @nobody");

			await processMentions("hey @target @target @nobody", actor.id, postId);

			const notes = await mentionNotificationsFor(target.id);
			expect(notes).toHaveLength(1);
			expect(notes[0]).toMatchObject({ actorId: actor.id, postId });
		});

		it("does not notify users who mention themselves", async () => {
			const actor = await createTestUser({ username: "selfie" });
			const postId = await createTestPost(actor.id, "talking to @selfie");

			await processMentions("talking to @selfie", actor.id, postId);

			expect(await mentionNotificationsFor(actor.id)).toHaveLength(0);
		});
	});
});
