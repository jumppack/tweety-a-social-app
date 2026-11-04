import type { IFollowsService } from "@tweety/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
	getFollowerCount,
	getFollowingCount,
	getFollowStatus,
	toggleFollow,
} from "../../services/follows.service";
import { logSwallowedError, withObservability } from "../observability";

export const followsHandler: IFollowsService = {
	toggleFollow: withObservability("FollowsService/toggleFollow", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await toggleFollow(request.username, auth.userId);

			return {
				success: true,
				following: result.following,
			};
		} catch (error) {
			return {
				success: false,
				following: false,
				error: error instanceof Error ? error.message : "Failed to toggle follow",
			};
		}
	}),

	getFollowStatus: withObservability("FollowsService/getFollowStatus", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await getFollowStatus(request.username, auth.userId);

			return { following: result.following };
		} catch (error) {
			logSwallowedError(error, "{ following: false }");
			return { following: false };
		}
	}),

	getFollowerCount: withObservability("FollowsService/getFollowerCount", async (request) => {
		try {
			const result = await getFollowerCount(request.username);
			return { count: result.count };
		} catch (error) {
			logSwallowedError(error, "{ count: 0 }");
			return { count: 0 };
		}
	}),

	getFollowingCount: withObservability("FollowsService/getFollowingCount", async (request) => {
		try {
			const result = await getFollowingCount(request.username);
			return { count: result.count };
		} catch (error) {
			logSwallowedError(error, "{ count: 0 }");
			return { count: 0 };
		}
	}),
};
