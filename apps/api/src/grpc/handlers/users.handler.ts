import type { IUsersService } from "@tweety/proto";
import { validateSessionToken } from "../../middleware/auth";
import { getUser, updateProfile } from "../../services/users.service";
import { toProtoTimestamp } from "../../services/utils";
import { withObservability } from "../observability";

/**
 */
export const usersHandler: IUsersService = {
	getUser: withObservability("UsersService/getUser", async (request) => {
		let userId: string | undefined;
		if (request.sessionToken) {
			try {
				const auth = validateSessionToken(request.sessionToken);
				userId = auth.userId;
			} catch {
				// Ignore invalid token for public access
			}
		}

		const user = await getUser(request.username, userId);

		return {
			id: user.id,
			email: user.email,
			username: user.username,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl || undefined,
			bio: user.bio || undefined,
			role: user.role,
			createdAt: toProtoTimestamp(user.createdAt),
			followerCount: user.followerCount,
			followingCount: user.followingCount,
			postCount: user.postCount,
			isFollowing: user.isFollowing,
		};
	}),

	updateProfile: withObservability("UsersService/updateProfile", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			await updateProfile({
				userId: auth.userId,
				displayName: request.displayName || undefined,
				bio: request.bio || undefined,
				avatarUrl: request.avatarUrl || undefined,
			});

			return { success: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to update profile",
			};
		}
	}),
};
