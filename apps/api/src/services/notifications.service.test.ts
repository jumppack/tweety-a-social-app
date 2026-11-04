import { describe, expect, it } from "vitest";
import { createTestNotification, createTestPost, createTestUser } from "../../tests/helpers";
import {
	getUnreadCount,
	getUserNotifications,
	markAllAsRead,
	markAsRead,
} from "./notifications.service";

/**
 */
describe("NotificationsService", () => {
	describe("getUserNotifications", () => {
		it("returns notifications with actor details", async () => {
			const recipient = await createTestUser();
			const actor = await createTestUser();
			const postId = await createTestPost(actor.id, "Test notification post");

			await createTestNotification(recipient.id, actor.id, "like", postId);

			const notifications = await getUserNotifications(recipient.id, 10, 0);
			expect(notifications).toHaveLength(1);
			expect(notifications[0].type).toBe("like");
			expect(notifications[0].actor?.username).toBe(actor.username);
			expect(notifications[0].read).toBe(false);
		});

		it("returns empty array when user has no notifications", async () => {
			const user = await createTestUser();
			const notifications = await getUserNotifications(user.id, 10, 0);
			expect(notifications).toHaveLength(0);
		});
	});

	describe("markAsRead", () => {
		it("marks a specific notification as read", async () => {
			const recipient = await createTestUser();
			const actor = await createTestUser();
			const notifId = await createTestNotification(recipient.id, actor.id, "follow");

			const countBefore = await getUnreadCount(recipient.id);
			expect(countBefore.count).toBe(1);

			await markAsRead(notifId, recipient.id);

			const countAfter = await getUnreadCount(recipient.id);
			expect(countAfter.count).toBe(0);
		});

		it("rejects marking another user's notification as read", async () => {
			const recipient = await createTestUser();
			const otherUser = await createTestUser();
			const actor = await createTestUser();
			const notifId = await createTestNotification(recipient.id, actor.id, "follow");

			await expect(markAsRead(notifId, otherUser.id)).rejects.toThrow("Unauthorized");
		});
	});

	describe("markAllAsRead", () => {
		it("marks all notifications as read for target user", async () => {
			const recipient = await createTestUser();
			const actor = await createTestUser();
			await createTestNotification(recipient.id, actor.id, "like");
			await createTestNotification(recipient.id, actor.id, "follow");

			const countBefore = await getUnreadCount(recipient.id);
			expect(countBefore.count).toBe(2);

			await markAllAsRead(recipient.id);

			const countAfter = await getUnreadCount(recipient.id);
			expect(countAfter.count).toBe(0);
		});
	});
});
