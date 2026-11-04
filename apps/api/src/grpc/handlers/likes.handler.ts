import type { ILikesService } from "@tweety/proto";
import { validateSessionToken } from "../../middleware/auth";
import {
	getCommentLikeStatus,
	getPostLikeStatus,
	toggleCommentLike,
	togglePostLike,
} from "../../services/likes.service";
import { logSwallowedError, withObservability } from "../observability";

export const likesHandler: ILikesService = {
	togglePostLike: withObservability("LikesService/togglePostLike", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await togglePostLike(request.postId, auth.userId);

			return {
				success: true,
				liked: result.liked,
			};
		} catch (error) {
			return {
				success: false,
				liked: false,
				error: error instanceof Error ? error.message : "Failed to toggle like",
			};
		}
	}),

	toggleCommentLike: withObservability("LikesService/toggleCommentLike", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await toggleCommentLike(request.commentId, auth.userId);

			return {
				success: true,
				liked: result.liked,
			};
		} catch (error) {
			return {
				success: false,
				liked: false,
				error: error instanceof Error ? error.message : "Failed to toggle like",
			};
		}
	}),

	getPostLikeStatus: withObservability("LikesService/getPostLikeStatus", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await getPostLikeStatus(request.postId, auth.userId);

			return { liked: result.liked };
		} catch (error) {
			logSwallowedError(error, "{ liked: false }");
			return { liked: false };
		}
	}),

	getCommentLikeStatus: withObservability("LikesService/getCommentLikeStatus", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			const result = await getCommentLikeStatus(request.commentId, auth.userId);

			return { liked: result.liked };
		} catch (error) {
			logSwallowedError(error, "{ liked: false }");
			return { liked: false };
		}
	}),
};
