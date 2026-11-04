import type { AuditLogResponse } from "@tweety/proto";
import { type AuditDetails, parseAuditDetails } from "./audit-format";
import { fromProtoTimestamp, getGrpcClient } from "./grpc.server";

export type AuditTargetLink = { kind: "user"; id: string } | { kind: "post"; id: string } | null;

export interface AuditEntry {
	id: string;
	adminId: string;
	adminUsername: string;
	action: string;
	targetType: string | null;
	targetId: string | null;
	/** Human label for the target, e.g. "@alice" or "Post 1a2b3c4d" */
	targetLabel: string | null;
	/** What the target label links to; null when there is no page for it */
	targetLink: AuditTargetLink;
	details: AuditDetails | null;
	ipAddress: string | null;
	createdAt: Date;
}

// IDs are "<timestamp>-<random>"; the random part tells items apart, the prefix doesn't
const shortId = (id: string) => id.split("-").pop()?.slice(0, 8) || id.slice(-8);

/** The content a log row is about; review_report rows point at the reported item. */
function effectiveTarget(log: AuditLogResponse, details: AuditDetails | null) {
	if (log.targetType === "report" && details) {
		const type = typeof details.targetType === "string" ? details.targetType : null;
		const id = typeof details.targetId === "string" ? details.targetId : null;
		if (type && id) return { type, id };
	}
	return log.targetType && log.targetId ? { type: log.targetType, id: log.targetId } : null;
}

/**
 * Maps raw audit rows to display entries, resolving user targets to their
 * usernames (one lookup per distinct user; deleted users resolve to null).
 */
export async function toAuditEntries(
	logs: AuditLogResponse[],
	sessionToken: string,
): Promise<AuditEntry[]> {
	const parsed = logs.map((log) => {
		const details = parseAuditDetails(log.details);
		return { log, details, target: effectiveTarget(log, details) };
	});

	const userIds = [
		...new Set(parsed.filter((p) => p.target?.type === "user").map((p) => p.target?.id as string)),
	];
	const client = getGrpcClient();
	const usernames = new Map<string, string | null>(
		await Promise.all(
			userIds.map(async (userId): Promise<[string, string | null]> => {
				try {
					const { response } = await client.admin.getUserDetails({ sessionToken, userId });
					return [userId, response.user?.username ?? null];
				} catch {
					return [userId, null]; // NOT_FOUND: the user was deleted
				}
			}),
		),
	);

	return parsed.map(({ log, details, target }) => {
		let targetLabel: string | null = null;
		let targetLink: AuditTargetLink = null;
		if (target) {
			switch (target.type) {
				case "user": {
					const username = usernames.get(target.id);
					if (username) {
						targetLabel = `@${username}`;
						targetLink = { kind: "user", id: target.id };
					} else {
						const old = typeof details?.username === "string" ? details.username : null;
						targetLabel = old ? `@${old} (deleted)` : "Deleted user";
					}
					break;
				}
				case "post":
					targetLabel = `Post ${shortId(target.id)}`;
					targetLink = { kind: "post", id: target.id };
					break;
				case "comment":
					targetLabel = `Comment ${shortId(target.id)}`;
					break;
				default:
					targetLabel = `${target.type} ${shortId(target.id)}`;
			}
		}

		return {
			id: log.id,
			adminId: log.adminId,
			adminUsername: log.adminUsername,
			action: log.action,
			targetType: target?.type ?? null,
			targetId: target?.id ?? null,
			targetLabel,
			targetLink,
			details,
			ipAddress: log.ipAddress ?? null,
			createdAt: fromProtoTimestamp(log.createdAt),
		};
	});
}
