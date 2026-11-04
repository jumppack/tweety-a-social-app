import { describe, expect, it } from "vitest";
import {
	describeAuditDetails,
	formatRelativeTime,
	getAuditActionLabel,
	getDateGroupLabel,
	groupByDate,
	parseAuditDetails,
} from "../../../src/lib/audit-format";

describe("parseAuditDetails", () => {
	it("keeps flat primitive fields", () => {
		expect(parseAuditDetails('{"reason":"Spam","n":2,"nested":{"x":1}}')).toEqual({
			reason: "Spam",
			n: 2,
		});
	});

	it("returns null for missing or invalid JSON", () => {
		expect(parseAuditDetails(undefined)).toBeNull();
		expect(parseAuditDetails("not json")).toBeNull();
		expect(parseAuditDetails("[1,2]")).toBeNull();
	});
});

describe("getAuditActionLabel", () => {
	it("maps the API's action names", () => {
		expect(getAuditActionLabel("update_role", null)).toBe("Changed Role");
		expect(getAuditActionLabel("ban_user", null)).toBe("Banned User");
		expect(getAuditActionLabel("delete_comment", null)).toBe("Deleted Comment");
	});

	it("labels report reviews by outcome", () => {
		expect(getAuditActionLabel("review_report", { action: "dismiss" })).toBe("Dismissed Report");
		expect(getAuditActionLabel("review_report", { action: "remove_content" })).toBe(
			"Removed Reported Content",
		);
		expect(getAuditActionLabel("review_report", null)).toBe("Reviewed Report");
	});

	it("humanizes unknown actions", () => {
		expect(getAuditActionLabel("purge_cache", null)).toBe("Purge cache");
	});
});

describe("describeAuditDetails", () => {
	it("formats reasons, role changes and report notes", () => {
		expect(describeAuditDetails("ban_user", { reason: "Spam" })).toBe("Reason: Spam");
		expect(describeAuditDetails("update_role", { oldRole: "user", newRole: "moderator" })).toBe(
			"user → moderator",
		);
		expect(
			describeAuditDetails("review_report", {
				action: "dismiss",
				targetType: "post",
				targetId: "p1",
				notes: "Fine",
			}),
		).toBe("Notes: Fine");
	});

	it("returns null when there is nothing to show", () => {
		expect(describeAuditDetails("unban_user", null)).toBeNull();
		expect(describeAuditDetails("delete_post", { reason: "  " })).toBeNull();
	});
});

describe("time helpers", () => {
	const now = new Date(2026, 10, 4, 12, 0, 0);

	it("formats relative times", () => {
		expect(formatRelativeTime(new Date(now.getTime() - 10_000), now)).toBe("Just now");
		expect(formatRelativeTime(new Date(now.getTime() - 60_000), now)).toBe("1 minute ago");
		expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000), now)).toBe("5 minutes ago");
		expect(formatRelativeTime(new Date(now.getTime() - 3 * 3_600_000), now)).toBe("3 hours ago");
		expect(formatRelativeTime(new Date(now.getTime() - 2 * 86_400_000), now)).toBe("2 days ago");
	});

	it("labels and groups by calendar day", () => {
		const today = new Date(2026, 10, 4, 1, 0);
		const yesterday = new Date(2026, 10, 3, 23, 0);
		const older = new Date(2026, 9, 20, 9, 0);
		expect(getDateGroupLabel(today, now)).toBe("Today");
		expect(getDateGroupLabel(yesterday, now)).toBe("Yesterday");

		const groups = groupByDate(
			[
				{ createdAt: today },
				{ createdAt: yesterday },
				{ createdAt: yesterday },
				{ createdAt: older },
			],
			now,
		);
		expect(groups.map((g) => [g.label, g.items.length])).toEqual([
			["Today", 1],
			["Yesterday", 2],
			[getDateGroupLabel(older, now), 1],
		]);
	});
});
