import type {
	AdminCommentResponse,
	AdminPostResponse,
	AdminUserResponse,
	AuditLogResponse,
	IAdminService,
	ReportResponse,
} from "@tweety/proto";
import { requireAdmin, requireSuperAdmin, validateSessionToken } from "../../middleware/auth";
import {
	banUser,
	deleteCommentAdmin,
	deletePostAdmin,
	deleteUser,
	getAuditLogs,
	getDashboardStats,
	getPostAdmin,
	getReport,
	getUserDetails,
	listCommentsAdmin,
	listPostsAdmin,
	listReports,
	listUsers,
	reviewReport,
	unbanUser,
	updateUserRole,
} from "../../services/admin.service";
import { toProtoTimestamp } from "../../services/utils";
import { withObservability } from "../observability";

function toAdminUserResponse(user: any): AdminUserResponse {
	return {
		id: user.id,
		email: user.email,
		username: user.username,
		displayName: user.displayName,
		avatarUrl: user.avatarUrl || undefined,
		bio: user.bio || undefined,
		role: user.role,
		createdAt: toProtoTimestamp(user.createdAt),
		updatedAt: toProtoTimestamp(user.updatedAt),
		bannedAt: user.bannedAt ? toProtoTimestamp(user.bannedAt) : undefined,
		bannedReason: user.bannedReason || undefined,
		postCount: user.postCount || 0,
		commentCount: user.commentCount || 0,
	};
}

function toReportResponse(report: any): ReportResponse {
	return {
		id: report.id,
		reporterId: report.reporterId,
		reporterUsername: report.reporterUsername,
		targetType: report.targetType,
		targetId: report.targetId,
		reason: report.reason,
		description: report.description || undefined,
		status: report.status,
		reviewedBy: report.reviewedBy || undefined,
		reviewedAt: report.reviewedAt ? toProtoTimestamp(report.reviewedAt) : undefined,
		createdAt: toProtoTimestamp(report.createdAt),
		targetExists: !!report.targetExists,
		targetPreview: report.targetPreview || undefined,
		targetAuthorId: report.targetAuthorId || undefined,
		targetAuthorUsername: report.targetAuthorUsername || undefined,
		targetPostId: report.targetPostId || undefined,
	};
}

type PostRow = Awaited<ReturnType<typeof listPostsAdmin>>["posts"][number];
type CommentRow = Awaited<ReturnType<typeof listCommentsAdmin>>["comments"][number];

function toAdminPostResponse(post: PostRow): AdminPostResponse {
	return {
		id: post.id,
		content: post.content,
		authorId: post.authorId,
		authorUsername: post.authorUsername,
		authorDisplayName: post.authorDisplayName,
		likeCount: Number(post.likeCount) || 0,
		commentCount: Number(post.commentCount) || 0,
		reportCount: Number(post.reportCount) || 0,
		createdAt: toProtoTimestamp(post.createdAt),
	};
}

function toAdminCommentResponse(comment: CommentRow): AdminCommentResponse {
	return {
		id: comment.id,
		content: comment.content,
		postId: comment.postId,
		postExcerpt: comment.postExcerpt,
		authorId: comment.authorId,
		authorUsername: comment.authorUsername,
		authorDisplayName: comment.authorDisplayName,
		reportCount: Number(comment.reportCount) || 0,
		createdAt: toProtoTimestamp(comment.createdAt),
	};
}

function toAuditLogResponse(log: any): AuditLogResponse {
	return {
		id: log.id,
		adminId: log.adminId,
		adminUsername: log.adminUsername,
		action: log.action,
		targetType: log.targetType || undefined,
		targetId: log.targetId || undefined,
		details: log.details || undefined,
		ipAddress: log.ipAddress || undefined,
		createdAt: toProtoTimestamp(log.createdAt),
	};
}

export const adminHandler: IAdminService = {
	listUsers: withObservability("AdminService/listUsers", async (request) => {
		const auth = validateSessionToken(request.sessionToken);
		requireAdmin(auth);

		const result = await listUsers({
			limit: request.pagination?.limit || 20,
			offset: request.pagination?.offset || 0,
			searchQuery: request.searchQuery || undefined,
			roleFilter: request.roleFilter || undefined,
		});

		return {
			users: result.users.map(toAdminUserResponse),
			total: result.total,
		};
	}),

	getUserDetails: withObservability("AdminService/getUserDetails", async (request) => {
		const auth = validateSessionToken(request.sessionToken);
		requireAdmin(auth);

		const user = await getUserDetails(request.userId);

		return {
			user: toAdminUserResponse(user),
		};
	}),

	banUser: withObservability("AdminService/banUser", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await banUser(request.userId, request.reason, auth.userId);

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to ban user",
			};
		}
	}),

	unbanUser: withObservability("AdminService/unbanUser", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await unbanUser(request.userId, auth.userId);

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to unban user",
			};
		}
	}),

	updateUserRole: withObservability("AdminService/updateUserRole", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			// Role changes are admin-only: with requireAdmin a moderator could
			// promote themselves (or anyone) to admin.
			requireSuperAdmin(auth);

			await updateUserRole(request.userId, request.role, auth.userId);

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to update role",
			};
		}
	}),

	deleteUser: withObservability("AdminService/deleteUser", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await deleteUser(request.userId, auth.userId);

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to delete user",
			};
		}
	}),

	deletePostAdmin: withObservability("AdminService/deletePostAdmin", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await deletePostAdmin(request.postId, request.reason, auth.userId);

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to delete post",
			};
		}
	}),

	deleteCommentAdmin: withObservability("AdminService/deleteCommentAdmin", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await deleteCommentAdmin(request.commentId, request.reason, auth.userId);

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to delete comment",
			};
		}
	}),

	listPostsAdmin: withObservability("AdminService/listPostsAdmin", async (request) => {
		const auth = validateSessionToken(request.sessionToken);
		requireAdmin(auth);

		const result = await listPostsAdmin({
			limit: request.pagination?.limit || 20,
			offset: request.pagination?.offset || 0,
			searchQuery: request.searchQuery || undefined,
			reportedOnly: request.reportedOnly,
		});

		return { posts: result.posts.map(toAdminPostResponse), total: result.total };
	}),

	getPostAdmin: withObservability("AdminService/getPostAdmin", async (request) => {
		const auth = validateSessionToken(request.sessionToken);
		requireAdmin(auth);

		const result = await getPostAdmin(request.postId);

		return {
			post: toAdminPostResponse(result.post),
			comments: result.comments.map(toAdminCommentResponse),
			reports: result.reports.map(toReportResponse),
		};
	}),

	listCommentsAdmin: withObservability("AdminService/listCommentsAdmin", async (request) => {
		const auth = validateSessionToken(request.sessionToken);
		requireAdmin(auth);

		const result = await listCommentsAdmin({
			limit: request.pagination?.limit || 20,
			offset: request.pagination?.offset || 0,
			searchQuery: request.searchQuery || undefined,
			reportedOnly: request.reportedOnly,
		});

		return { comments: result.comments.map(toAdminCommentResponse), total: result.total };
	}),

	listReports: withObservability("AdminService/listReports", async (request) => {
		const auth = validateSessionToken(request.sessionToken);
		requireAdmin(auth);

		const result = await listReports({
			limit: request.pagination?.limit || 20,
			offset: request.pagination?.offset || 0,
			statusFilter: request.statusFilter || undefined,
			typeFilter: request.typeFilter || undefined,
		});

		return {
			reports: result.reports.map(toReportResponse),
			total: result.total,
		};
	}),

	getReport: withObservability("AdminService/getReport", async (request) => {
		const auth = validateSessionToken(request.sessionToken);
		requireAdmin(auth);

		const report = await getReport(request.reportId);

		return toReportResponse(report);
	}),

	reviewReport: withObservability("AdminService/reviewReport", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			requireAdmin(auth);

			await reviewReport(request.reportId, request.action, auth.userId, request.notes || undefined);

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to review report",
			};
		}
	}),

	getDashboardStats: withObservability("AdminService/getDashboardStats", async (request) => {
		const auth = validateSessionToken(request.sessionToken);
		requireAdmin(auth);

		const stats = await getDashboardStats();

		return {
			totalUsers: stats.totalUsers,
			totalPosts: stats.totalPosts,
			totalComments: stats.totalComments,
			pendingReports: stats.pendingReports,
			newUsersToday: stats.newUsersToday,
			newPostsToday: stats.newPostsToday,
			bannedUsers: stats.bannedUsers,
		};
	}),

	getAuditLogs: withObservability("AdminService/getAuditLogs", async (request) => {
		const auth = validateSessionToken(request.sessionToken);
		requireAdmin(auth);

		const result = await getAuditLogs({
			limit: request.pagination?.limit || 50,
			offset: request.pagination?.offset || 0,
			adminIdFilter: request.adminIdFilter || undefined,
			actionFilter: request.actionFilter || undefined,
		});

		return {
			logs: result.logs.map(toAuditLogResponse),
			total: result.total,
		};
	}),
};
