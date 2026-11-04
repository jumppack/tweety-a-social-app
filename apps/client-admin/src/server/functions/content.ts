import { createServerFn } from "@tanstack/react-start";
import type { AdminCommentResponse, AdminPostResponse, ReportResponse } from "@tweety/proto";
import {
	fromProtoTimestamp,
	getGrpcClient,
	requireAdminGrpcSessionToken,
} from "../../lib/grpc.server";

export const CONTENT_PAGE_SIZE = 20;

export interface AdminPost {
	id: string;
	content: string;
	authorId: string;
	authorUsername: string;
	authorDisplayName: string;
	likeCount: number;
	commentCount: number;
	/** Pending reports only. */
	reportCount: number;
	createdAt: Date;
}

export interface AdminComment {
	id: string;
	content: string;
	postId: string;
	postExcerpt: string;
	authorId: string;
	authorUsername: string;
	authorDisplayName: string;
	/** Pending reports only. */
	reportCount: number;
	createdAt: Date;
}

export type ReportStatus = "pending" | "reviewed" | "actioned" | "dismissed";

export interface PostReport {
	id: string;
	reporterId: string;
	reporterUsername: string;
	reason: string;
	description: string | null;
	status: ReportStatus;
	createdAt: Date;
	reviewedAt: Date | null;
}

export interface ContentListInput {
	search?: string;
	reportedOnly?: boolean;
	offset?: number;
}

function mapPost(post: AdminPostResponse): AdminPost {
	return {
		id: post.id,
		content: post.content,
		authorId: post.authorId,
		authorUsername: post.authorUsername,
		authorDisplayName: post.authorDisplayName,
		likeCount: post.likeCount,
		commentCount: post.commentCount,
		reportCount: post.reportCount,
		createdAt: fromProtoTimestamp(post.createdAt),
	};
}

function mapComment(comment: AdminCommentResponse): AdminComment {
	return {
		id: comment.id,
		content: comment.content,
		postId: comment.postId,
		postExcerpt: comment.postExcerpt,
		authorId: comment.authorId,
		authorUsername: comment.authorUsername,
		authorDisplayName: comment.authorDisplayName,
		reportCount: comment.reportCount,
		createdAt: fromProtoTimestamp(comment.createdAt),
	};
}

function mapReport(report: ReportResponse): PostReport {
	return {
		id: report.id,
		reporterId: report.reporterId,
		reporterUsername: report.reporterUsername,
		reason: report.reason,
		description: report.description ?? null,
		status: report.status as ReportStatus,
		createdAt: fromProtoTimestamp(report.createdAt),
		reviewedAt: report.reviewedAt ? fromProtoTimestamp(report.reviewedAt) : null,
	};
}

/** Throws the API's soft error so callers can show it to the admin. */
function assertSuccess(response: { success: boolean; error?: string }, fallback: string) {
	if (!response.success) {
		throw new Error(response.error || fallback);
	}
}

function isNotFound(err: unknown) {
	const code = (err as { code?: unknown } | null)?.code;
	return code === "NOT_FOUND" || code === 5;
}

function listRequest(data: ContentListInput) {
	return {
		pagination: { limit: CONTENT_PAGE_SIZE, offset: Math.max(0, data.offset ?? 0) },
		searchQuery: data.search?.trim() || undefined,
		reportedOnly: !!data.reportedOnly,
	};
}

export const listPosts = createServerFn()
	.inputValidator((d: ContentListInput = {}) => d)
	.handler(async ({ data }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		const { response } = await getGrpcClient().admin.listPostsAdmin({
			sessionToken,
			...listRequest(data),
		});
		return { posts: response.posts.map(mapPost), total: response.total };
	});

export const getPost = createServerFn()
	.inputValidator((postId: string) => postId)
	.handler(async ({ data: postId }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		try {
			const { response } = await getGrpcClient().admin.getPostAdmin({ sessionToken, postId });
			if (!response.post) return null;
			return {
				post: mapPost(response.post),
				comments: response.comments.map(mapComment),
				reports: response.reports.map(mapReport),
			};
		} catch (err) {
			// Unknown or deleted id renders the "post not found" state
			if (isNotFound(err)) return null;
			throw err;
		}
	});

export const deletePost = createServerFn({ method: "POST" })
	.inputValidator((d: { postId: string; reason: string }) => d)
	.handler(async ({ data }) => {
		const reason = data.reason.trim();
		if (!reason) throw new Error("A reason is required");
		const sessionToken = await requireAdminGrpcSessionToken();
		const { response } = await getGrpcClient().admin.deletePostAdmin({
			sessionToken,
			postId: data.postId,
			reason,
		});
		assertSuccess(response, "Failed to delete post");
		return { success: true };
	});

export const listComments = createServerFn()
	.inputValidator((d: ContentListInput = {}) => d)
	.handler(async ({ data }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		const { response } = await getGrpcClient().admin.listCommentsAdmin({
			sessionToken,
			...listRequest(data),
		});
		return { comments: response.comments.map(mapComment), total: response.total };
	});

export const deleteComment = createServerFn({ method: "POST" })
	.inputValidator((d: { commentId: string; reason: string }) => d)
	.handler(async ({ data }) => {
		const reason = data.reason.trim();
		if (!reason) throw new Error("A reason is required");
		const sessionToken = await requireAdminGrpcSessionToken();
		const { response } = await getGrpcClient().admin.deleteCommentAdmin({
			sessionToken,
			commentId: data.commentId,
			reason,
		});
		assertSuccess(response, "Failed to delete comment");
		return { success: true };
	});
