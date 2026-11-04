/**
 * Pure, client-safe helpers for turning audit log rows and timestamps into
 * the text the Dashboard and Audit Log pages show.
 */

/** Action names the API actually writes to the audit log. */
export const AUDIT_ACTIONS = [
	"ban_user",
	"unban_user",
	"update_role",
	"delete_user",
	"delete_post",
	"delete_comment",
	"review_report",
] as const;

export type KnownAuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_FILTER_LABELS: Record<KnownAuditAction, string> = {
	ban_user: "Banned user",
	unban_user: "Unbanned user",
	update_role: "Changed role",
	delete_user: "Deleted user",
	delete_post: "Deleted post",
	delete_comment: "Deleted comment",
	review_report: "Reviewed report",
};

/** Flat details object; nested values are dropped so it stays serializable and printable. */
export type AuditDetails = Record<string, string | number | boolean>;

/** Parses the API's JSON details string; anything unparseable becomes null. */
export function parseAuditDetails(raw: string | undefined | null): AuditDetails | null {
	if (!raw) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
	const details: AuditDetails = {};
	for (const [key, value] of Object.entries(parsed)) {
		if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			details[key] = value;
		}
	}
	return details;
}

const str = (value: unknown): string | null =>
	typeof value === "string" && value.trim() ? value.trim() : null;

function humanize(action: string): string {
	const words = action.replace(/[_-]+/g, " ").trim();
	return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown action";
}

export function getAuditActionLabel(action: string, details: AuditDetails | null): string {
	switch (action) {
		case "ban_user":
			return "Banned User";
		case "unban_user":
			return "Unbanned User";
		case "update_role":
			return "Changed Role";
		case "delete_user":
			return "Deleted User";
		case "delete_post":
			return "Deleted Post";
		case "delete_comment":
			return "Deleted Comment";
		case "review_report":
			switch (details?.action) {
				case "dismiss":
					return "Dismissed Report";
				case "remove_content":
					return "Removed Reported Content";
				case "ban_user":
					return "Banned Reported User";
				default:
					return "Reviewed Report";
			}
		default:
			return humanize(action);
	}
}

/** One readable line built from the details JSON, or null when there is nothing to say. */
export function describeAuditDetails(action: string, details: AuditDetails | null): string | null {
	if (!details) return null;
	const reason = str(details.reason);
	switch (action) {
		case "ban_user":
		case "delete_post":
		case "delete_comment":
			return reason ? `Reason: ${reason}` : null;
		case "update_role": {
			const oldRole = str(details.oldRole);
			const newRole = str(details.newRole);
			if (oldRole && newRole) return `${oldRole} → ${newRole}`;
			return newRole ? `New role: ${newRole}` : null;
		}
		case "delete_user": {
			const username = str(details.username);
			return username ? `Account @${username} removed` : null;
		}
		case "review_report": {
			// The reported item is already shown as the target; only notes add information
			const notes = str(details.notes);
			return notes ? `Notes: ${notes}` : null;
		}
		default: {
			// Unknown action: show its simple fields rather than raw JSON
			const parts = Object.entries(details).map(([k, v]) => `${humanize(k)}: ${v}`);
			return parts.length ? parts.join(" · ") : null;
		}
	}
}

/** Past-tense verb phrase for one-line activity text, e.g. "banned". */
export function getAuditVerb(action: string, details: AuditDetails | null): string {
	switch (action) {
		case "ban_user":
			return "banned";
		case "unban_user":
			return "unbanned";
		case "update_role":
			return "changed the role of";
		case "delete_user":
			return "deleted";
		case "delete_post":
			return "deleted";
		case "delete_comment":
			return "deleted";
		case "review_report":
			return details?.action === "dismiss" ? "dismissed a report on" : "acted on a report on";
		default:
			return humanize(action).toLowerCase();
	}
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(date: Date | string, now: Date = new Date()): string {
	const then = new Date(date);
	const diff = now.getTime() - then.getTime();
	if (diff < MINUTE) return "Just now";
	const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
	if (diff < HOUR) return plural(Math.floor(diff / MINUTE), "minute");
	if (diff < DAY) return plural(Math.floor(diff / HOUR), "hour");
	if (diff < 7 * DAY) return plural(Math.floor(diff / DAY), "day");
	return then.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: then.getFullYear() === now.getFullYear() ? undefined : "numeric",
	});
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today", "Yesterday" or a long date, in the viewer's local time. */
export function getDateGroupLabel(date: Date | string, now: Date = new Date()): string {
	const then = new Date(date);
	const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY);
	if (days === 0) return "Today";
	if (days === 1) return "Yesterday";
	return then.toLocaleDateString(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: then.getFullYear() === now.getFullYear() ? undefined : "numeric",
	});
}

/** Groups items (already sorted newest first) under date labels, keeping order. */
export function groupByDate<T extends { createdAt: Date | string }>(
	items: T[],
	now: Date = new Date(),
): Array<{ label: string; items: T[] }> {
	const groups: Array<{ label: string; items: T[] }> = [];
	for (const item of items) {
		const label = getDateGroupLabel(item.createdAt, now);
		const last = groups[groups.length - 1];
		if (last && last.label === label) last.items.push(item);
		else groups.push({ label, items: [item] });
	}
	return groups;
}
