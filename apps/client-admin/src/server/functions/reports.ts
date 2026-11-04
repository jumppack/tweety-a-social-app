import { createServerFn } from "@tanstack/react-start";
import type { ReportResponse } from "@tweety/proto";
import {
	fromProtoTimestamp,
	getGrpcClient,
	requireAdminGrpcSessionToken,
} from "../../lib/grpc.server";

/** Real report statuses. "reviewed" exists in the schema but nothing sets it. */
export type ReportStatus = "pending" | "reviewed" | "actioned" | "dismissed";
export type ReportStatusFilter = "pending" | "actioned" | "dismissed" | "all";
export type ReportTargetType = "post" | "comment" | "user";
export type ReviewAction = "dismiss" | "remove_content" | "ban_user";

export interface AdminReport {
	id: string;
	reporterId: string;
	reporterUsername: string;
	targetType: ReportTargetType;
	targetId: string;
	reason: string;
	description: string | null;
	status: ReportStatus;
	reviewedBy: string | null;
	reviewedAt: Date | null;
	createdAt: Date;
	/** False once the reported post, comment or user has been deleted. */
	targetExists: boolean;
	targetPreview: string | null;
	targetAuthorId: string | null;
	targetAuthorUsername: string | null;
	/** The post itself for post reports, the parent post for comment reports. */
	targetPostId: string | null;
}

export interface ReportCounts {
	pending: number;
	actioned: number;
	dismissed: number;
	all: number;
}

function mapReport(report: ReportResponse): AdminReport {
	return {
		id: report.id,
		reporterId: report.reporterId,
		reporterUsername: report.reporterUsername,
		targetType: report.targetType as ReportTargetType,
		targetId: report.targetId,
		reason: report.reason,
		description: report.description || null,
		status: report.status as ReportStatus,
		reviewedBy: report.reviewedBy ?? null,
		reviewedAt: report.reviewedAt ? fromProtoTimestamp(report.reviewedAt) : null,
		createdAt: fromProtoTimestamp(report.createdAt),
		targetExists: report.targetExists,
		targetPreview: report.targetPreview ?? null,
		targetAuthorId: report.targetAuthorId ?? null,
		targetAuthorUsername: report.targetAuthorUsername ?? null,
		targetPostId: report.targetPostId ?? null,
	};
}

/** Throws the API's soft error so callers can show it to the moderator. */
function assertSuccess(response: { success: boolean; error?: string }, fallback: string) {
	if (!response.success) {
		throw new Error(response.error || fallback);
	}
}

export interface ListReportsInput {
	status?: ReportStatusFilter;
	type?: ReportTargetType;
	limit?: number;
	offset?: number;
}

/**
 * One page of reports for the selected tab, plus the per-status totals the
 * tabs show (each respecting the type filter).
 */
export const listReports = createServerFn()
	.inputValidator((d: ListReportsInput = {}) => d)
	.handler(async ({ data }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		const { admin } = getGrpcClient();
		const typeFilter = data.type || undefined;
		const status = data.status ?? "pending";

		const total = async (statusFilter?: string) => {
			// limit 0 would fall back to the API's default page size; 1 is the cheapest real count
			const { response } = await admin.listReports({
				sessionToken,
				pagination: { limit: 1, offset: 0 },
				statusFilter,
				typeFilter,
			});
			return response.total;
		};

		const [page, pending, actioned, dismissed, all] = await Promise.all([
			admin.listReports({
				sessionToken,
				pagination: { limit: data.limit ?? 25, offset: data.offset ?? 0 },
				statusFilter: status === "all" ? undefined : status,
				typeFilter,
			}),
			total("pending"),
			total("actioned"),
			total("dismissed"),
			total(),
		]);

		const counts: ReportCounts = { pending, actioned, dismissed, all };
		return {
			reports: page.response.reports.map(mapReport),
			total: page.response.total,
			counts,
		};
	});

export const reviewReport = createServerFn({ method: "POST" })
	.inputValidator((d: { reportId: string; action: ReviewAction; notes?: string }) => d)
	.handler(async ({ data }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		const { response } = await getGrpcClient().admin.reviewReport({
			sessionToken,
			reportId: data.reportId,
			action: data.action,
			notes: data.notes?.trim() || undefined,
		});
		assertSuccess(response, "Failed to review report");
		return { success: true };
	});
