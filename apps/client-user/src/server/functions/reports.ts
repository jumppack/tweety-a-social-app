import { createServerFn } from "@tanstack/react-start";
import { getGrpcClient, requireGrpcSessionToken } from "../../lib/grpc.server";

export type ReportTargetType = "post" | "comment" | "user";

export interface ReportContentInput {
	targetType: ReportTargetType;
	targetId: string;
	reason: string;
	description?: string;
}

/**
 * Report a post, comment or user for moderator review.
 * Throws the API's soft error message (e.g. "You have already reported
 * this...") so the dialog can show it to the user.
 */
export const reportContent = createServerFn({ method: "POST" })
	.inputValidator((d: ReportContentInput) => d)
	.handler(async ({ data }) => {
		const sessionToken = await requireGrpcSessionToken();
		const client = getGrpcClient();

		const description = data.description?.trim();
		const { response } = await client.reports.createReport({
			sessionToken,
			targetType: data.targetType,
			targetId: data.targetId,
			reason: data.reason,
			...(description ? { description } : {}),
		});

		if (!response.success) {
			throw new Error(response.error || "Failed to submit report");
		}

		return { success: true, reportId: response.reportId ?? null };
	});
