import { createTweetyClient } from "@tweety/grpc-client";

/**
 * Seeds real content through the API so admin tests act on throwaway data
 * instead of the seeded posts every other test depends on.
 */

const client = () => createTweetyClient({ host: process.env.GRPC_API_HOST || "localhost:50051" });

export interface SeedUser {
	id: string;
	username: string;
	displayName: string;
	sessionToken: string;
}

function shortId() {
	return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export async function registerUser(prefix = "seed"): Promise<SeedUser> {
	const id = shortId();
	const username = `${prefix}_${id}`.slice(0, 20);
	const displayName = `${prefix} ${id}`;
	const { response } = await client().auth.register({
		email: `${username}@example.com`,
		username,
		displayName,
		password: "password123",
	});
	if (!response.success) throw new Error(`register failed: ${response.error}`);
	return { id: response.userId, username, displayName, sessionToken: response.sessionToken };
}

export async function createPost(author: SeedUser, content = `Seed post ${shortId()}`) {
	const { response } = await client().posts.createPost({
		sessionToken: author.sessionToken,
		content,
	});
	if (!response.success) throw new Error(`createPost failed: ${response.error}`);
	return { id: response.postId, content };
}

export async function createComment(
	author: SeedUser,
	postId: string,
	content = `Seed comment ${shortId()}`,
) {
	const { response } = await client().comments.createComment({
		sessionToken: author.sessionToken,
		postId,
		content,
	});
	if (!response.success) throw new Error(`createComment failed: ${response.error}`);
	return { id: response.commentId, content };
}

export async function createReport(
	reporter: SeedUser,
	targetType: "post" | "comment" | "user",
	targetId: string,
	reason = "Spam",
	description?: string,
) {
	const { response } = await client().reports.createReport({
		sessionToken: reporter.sessionToken,
		targetType,
		targetId,
		reason,
		description,
	});
	if (!response.success) throw new Error(`createReport failed: ${response.error}`);
	return { id: response.reportId as string };
}

/**
 * An author with one post and one comment on it, plus a second user who
 * reported whichever of them `reportTarget` names.
 */
export async function seedReportedContent(
	reportTarget: "post" | "comment" | "user" = "post",
	reason = "Spam",
) {
	const author = await registerUser("author");
	const reporter = await registerUser("reporter");
	const post = await createPost(author, `Reported post ${shortId()}`);
	const comment = await createComment(author, post.id, `Reported comment ${shortId()}`);
	const targetId =
		reportTarget === "post" ? post.id : reportTarget === "comment" ? comment.id : author.id;
	const report = await createReport(
		reporter,
		reportTarget,
		targetId,
		reason,
		`Details ${shortId()}`,
	);
	return { author, reporter, post, comment, report };
}
