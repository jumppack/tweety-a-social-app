import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors/app-error";
import { generateId } from "./utils";

const { posts, comments, users, reports } = schema;

export type ReportTargetType = "post" | "comment" | "user";

export interface CreateReportInput {
	targetType: string;
	targetId: string;
	reason: string;
	description?: string;
}

const TARGET_TYPES: ReportTargetType[] = ["post", "comment", "user"];
const MAX_REASON = 100;
const MAX_DESCRIPTION = 500;

/** Returns the id of the user who owns the target, or throws NotFound. */
async function getTargetOwner(targetType: ReportTargetType, targetId: string): Promise<string> {
	if (targetType === "post") {
		const post = await db
			.select({ authorId: posts.authorId })
			.from(posts)
			.where(eq(posts.id, targetId))
			.get();
		if (!post) throw new NotFoundError("Post not found");
		return post.authorId;
	}
	if (targetType === "comment") {
		const comment = await db
			.select({ authorId: comments.authorId })
			.from(comments)
			.where(eq(comments.id, targetId))
			.get();
		if (!comment) throw new NotFoundError("Comment not found");
		return comment.authorId;
	}
	const user = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).get();
	if (!user) throw new NotFoundError("User not found");
	return user.id;
}

/**
 * Lets a signed-in user flag a post, comment or user for moderator review.
 * Reports land as "pending" and are reviewed through the admin service.
 */
export async function createReport(reporterId: string, input: CreateReportInput) {
	if (!TARGET_TYPES.includes(input.targetType as ReportTargetType)) {
		throw new ValidationError("Invalid report target");
	}
	const targetType = input.targetType as ReportTargetType;
	const reason = input.reason?.trim();
	const description = input.description?.trim() || null;

	if (!reason) throw new ValidationError("A reason is required");
	if (reason.length > MAX_REASON) throw new ValidationError("Reason is too long");
	if (description && description.length > MAX_DESCRIPTION) {
		throw new ValidationError(`Details must be ${MAX_DESCRIPTION} characters or fewer`);
	}

	const ownerId = await getTargetOwner(targetType, input.targetId);
	if (ownerId === reporterId) {
		throw new ForbiddenError(
			targetType === "user"
				? "You cannot report yourself"
				: `You cannot report your own ${targetType}`,
		);
	}

	const existing = await db
		.select({ id: reports.id })
		.from(reports)
		.where(
			and(
				eq(reports.reporterId, reporterId),
				eq(reports.targetType, targetType),
				eq(reports.targetId, input.targetId),
				eq(reports.status, "pending"),
			),
		)
		.get();
	if (existing) {
		throw new ConflictError("You have already reported this. A moderator will review it soon.");
	}

	const id = generateId();
	await db.insert(reports).values({
		id,
		reporterId,
		targetType,
		targetId: input.targetId,
		reason,
		description,
	});
	return { id };
}
