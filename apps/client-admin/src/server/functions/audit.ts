import { createServerFn } from "@tanstack/react-start";
import { toAuditEntries } from "../../lib/audit-entries.server";
import { getGrpcClient, requireAdminGrpcSessionToken } from "../../lib/grpc.server";

export type { AuditEntry, AuditTargetLink } from "../../lib/audit-entries.server";

export const AUDIT_PAGE_SIZE = 50;

export const listAuditLogs = createServerFn()
	.inputValidator((d: { action?: string; offset?: number } = {}) => ({
		action: d.action?.trim() || undefined,
		offset: Math.max(0, Math.floor(d.offset ?? 0)),
	}))
	.handler(async ({ data }) => {
		const sessionToken = await requireAdminGrpcSessionToken();
		const { response } = await getGrpcClient().admin.getAuditLogs({
			sessionToken,
			pagination: { limit: AUDIT_PAGE_SIZE, offset: data.offset },
			actionFilter: data.action,
		});
		const entries = await toAuditEntries(response.logs, sessionToken);
		// The API's total ignores actionFilter, so a full page is the only
		// reliable "there may be more" signal when filtering.
		const hasMore =
			response.logs.length === AUDIT_PAGE_SIZE &&
			data.offset + response.logs.length < response.total;
		return { entries, hasMore };
	});
