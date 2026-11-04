import type { INotificationsService } from "@tweety/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
	deleteNotification,
	getUnreadCount,
	getUserNotifications,
	markAllAsRead,
	markAsRead,
} from "../../services/notifications.service";
import { toProtoTimestamp } from "../../services/utils";
import { logSwallowedError, withObservability } from "../observability";

export const notificationsHandler: INotificationsService = {
	getNotifications: withObservability("NotificationsService/getNotifications", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			const notifications = await getUserNotifications(
				auth.userId,
				request.limit || 20,
				request.offset || 0,
			);

			return {
				notifications: notifications.map((n) => ({
					id: n.id,
					type: n.type,
					read: n.read,
					actor: n.actor
						? {
								id: n.actor.id,
								username: n.actor.username,
								displayName: n.actor.displayName,
								avatarUrl: n.actor.avatarUrl || undefined,
							}
						: undefined,
					postId: n.postId || undefined,
					commentId: n.commentId || undefined,
					postContent: n.postContent || undefined,
					commentContent: n.commentContent || undefined,
					createdAt: toProtoTimestamp(n.createdAt),
				})),
			};
		} catch (error) {
			logSwallowedError(error, "{ notifications: [] }");
			return { notifications: [] };
		}
	}),

	getUnreadCount: withObservability("NotificationsService/getUnreadCount", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await getUnreadCount(auth.userId);
			return { count: result.count };
		} catch (error) {
			logSwallowedError(error, "{ count: 0 }");
			return { count: 0 };
		}
	}),

	markAsRead: withObservability("NotificationsService/markAsRead", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			await markAsRead(request.notificationId, auth.userId);
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to mark as read",
			};
		}
	}),

	markAllAsRead: withObservability("NotificationsService/markAllAsRead", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			await markAllAsRead(auth.userId);
			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to mark all as read",
			};
		}
	}),

	deleteNotification: withObservability(
		"NotificationsService/deleteNotification",
		async (request) => {
			try {
				const auth = validateSessionToken(request.sessionToken);
				await deleteNotification(request.notificationId, auth.userId);
				return { success: true };
			} catch (error) {
				return {
					success: false,
					error: error instanceof Error ? error.message : "Failed to delete notification",
				};
			}
		},
	),
};
