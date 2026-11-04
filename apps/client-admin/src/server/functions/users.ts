import { createServerFn } from "@tanstack/react-start";
import type { AdminUserResponse } from "@tweety/proto";
import {
	fromProtoTimestamp,
	getGrpcClient,
	requireAdminGrpcSessionToken,
} from "../../lib/grpc.server";

export type AdminRole = "user" | "admin" | "moderator";

export interface AdminUser {
	id: string;
	email: string;
	username: string;
	displayName: string;
	avatarUrl: string | null;
	bio: string | null;
	role: AdminRole;
	createdAt: Date;
	bannedAt: Date | null;
	bannedReason: string | null;
	postCount: number;
	commentCount: number;
}

function mapUser(user: AdminUserResponse): AdminUser {
	return {
		id: user.id,
		email: user.email,
		username: user.username,
		displayName: user.displayName,
		avatarUrl: user.avatarUrl ?? null,
		bio: user.bio ?? null,
		role: user.role as AdminRole,
		createdAt: fromProtoTimestamp(user.createdAt),
		bannedAt: user.bannedAt ? fromProtoTimestamp(user.bannedAt) : null,
		bannedReason: user.bannedReason ?? null,
		postCount: user.postCount,
		commentCount: user.commentCount,
	};
}

/** Throws the API's soft error so callers can show it to the admin. */
function assertSuccess(response: { success: boolean; error?: string }, fallback: string) {
	if (!response.success) {
		throw new Error(response.error || fallback);
	}
}

export const listUsers = createServerFn()
	.inputValidator((d: { search?: string } = {}) => d)
	.handler(async ({ data }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		const { response } = await getGrpcClient().admin.listUsers({
			sessionToken,
			pagination: { limit: 100, offset: 0 },
			searchQuery: data.search?.trim() || undefined,
		});
		return { users: response.users.map(mapUser), total: response.total };
	});

export const getUserDetails = createServerFn()
	.inputValidator((userId: string) => userId)
	.handler(async ({ data: userId }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		const client = getGrpcClient();

		let user: AdminUser;
		try {
			const { response } = await client.admin.getUserDetails({ sessionToken, userId });
			if (!response.user) return null;
			user = mapUser(response.user);
		} catch {
			// NOT_FOUND (unknown or deleted id) renders the "user not found" state
			return null;
		}

		const { response: postsResponse } = await client.posts.getUserPosts({
			username: user.username,
			sessionToken,
		});
		const recentPosts = postsResponse.posts.slice(0, 5).map((post) => ({
			id: post.id,
			content: post.content,
			createdAt: fromProtoTimestamp(post.createdAt),
			likeCount: post.likeCount,
			commentCount: post.commentCount,
		}));

		return { user, recentPosts };
	});

export const banUser = createServerFn({ method: "POST" })
	.inputValidator((d: { userId: string; reason: string }) => d)
	.handler(async ({ data }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		const { response } = await getGrpcClient().admin.banUser({
			sessionToken,
			userId: data.userId,
			reason: data.reason,
		});
		assertSuccess(response, "Failed to ban user");
		return { success: true };
	});

export const unbanUser = createServerFn({ method: "POST" })
	.inputValidator((userId: string) => userId)
	.handler(async ({ data: userId }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		const { response } = await getGrpcClient().admin.unbanUser({ sessionToken, userId });
		assertSuccess(response, "Failed to unban user");
		return { success: true };
	});

export const updateUserRole = createServerFn({ method: "POST" })
	.inputValidator((d: { userId: string; role: AdminRole }) => d)
	.handler(async ({ data }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		const { response } = await getGrpcClient().admin.updateUserRole({
			sessionToken,
			userId: data.userId,
			role: data.role,
		});
		assertSuccess(response, "Failed to update role");
		return { success: true };
	});
