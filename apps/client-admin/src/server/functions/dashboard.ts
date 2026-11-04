import { createServerFn } from "@tanstack/react-start";
import { type AuditEntry, toAuditEntries } from "../../lib/audit-entries.server";
import {
	fromProtoTimestamp,
	getGrpcClient,
	requireAdminGrpcSessionToken,
} from "../../lib/grpc.server";

export interface DashboardStats {
	totalUsers: number;
	totalPosts: number;
	totalComments: number;
	pendingReports: number;
	newUsersToday: number;
	newPostsToday: number;
	bannedUsers: number;
}

export type ActivityItem =
	| { kind: "audit"; id: string; createdAt: Date; entry: AuditEntry }
	| { kind: "user"; id: string; createdAt: Date; userId: string; username: string }
	| {
			kind: "post";
			id: string;
			createdAt: Date;
			postId: string;
			authorId: string;
			authorUsername: string;
			excerpt: string;
	  };

const RECENT_PER_SOURCE = 5;
const RECENT_ACTIVITY_LIMIT = 8;

const excerpt = (text: string, max = 60) =>
	text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

export const getDashboard = createServerFn().handler(async () => {
	const sessionToken = await requireAdminGrpcSessionToken();
	const { admin } = getGrpcClient();
	const pagination = { limit: RECENT_PER_SOURCE, offset: 0 };

	const [{ response: stats }, { response: audit }, { response: users }, { response: posts }] =
		await Promise.all([
			admin.getDashboardStats({ sessionToken }),
			admin.getAuditLogs({ sessionToken, pagination }),
			admin.listUsers({ sessionToken, pagination }),
			admin.listPostsAdmin({ sessionToken, pagination, reportedOnly: false }),
		]);

	const auditEntries = await toAuditEntries(audit.logs, sessionToken);

	// Admin actions, sign-ups and new posts, merged into one newest-first feed
	const activity: ActivityItem[] = [
		...auditEntries.map(
			(entry): ActivityItem => ({
				kind: "audit",
				id: `audit-${entry.id}`,
				createdAt: entry.createdAt,
				entry,
			}),
		),
		...users.users.map(
			(user): ActivityItem => ({
				kind: "user",
				id: `user-${user.id}`,
				createdAt: fromProtoTimestamp(user.createdAt),
				userId: user.id,
				username: user.username,
			}),
		),
		...posts.posts.map(
			(post): ActivityItem => ({
				kind: "post",
				id: `post-${post.id}`,
				createdAt: fromProtoTimestamp(post.createdAt),
				postId: post.id,
				authorId: post.authorId,
				authorUsername: post.authorUsername,
				excerpt: excerpt(post.content),
			}),
		),
	]
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
		.slice(0, RECENT_ACTIVITY_LIMIT);

	const dashboardStats: DashboardStats = {
		totalUsers: stats.totalUsers,
		totalPosts: stats.totalPosts,
		totalComments: stats.totalComments,
		pendingReports: stats.pendingReports,
		newUsersToday: stats.newUsersToday,
		newPostsToday: stats.newPostsToday,
		bannedUsers: stats.bannedUsers,
	};

	return { stats: dashboardStats, activity };
});
