import {
	Ban,
	Check,
	FileText,
	type LucideIcon,
	MessageSquare,
	RotateCcw,
	Shield,
	Trash2,
	User,
	UserX,
} from "lucide-react";

export type AuditTone = "danger" | "role" | "resolve" | "neutral";

export function getAuditActionIcon(action: string): LucideIcon {
	switch (action) {
		case "ban_user":
			return Ban;
		case "unban_user":
			return RotateCcw;
		case "delete_user":
			return UserX;
		case "delete_post":
		case "delete_comment":
			return Trash2;
		case "update_role":
			return Shield;
		case "review_report":
			return Check;
		default:
			return FileText;
	}
}

export function getAuditActionTone(action: string): AuditTone {
	switch (action) {
		case "ban_user":
		case "delete_user":
		case "delete_post":
		case "delete_comment":
			return "danger";
		case "update_role":
			return "role";
		case "unban_user":
		case "review_report":
			return "resolve";
		default:
			return "neutral";
	}
}

export function getAuditTargetIcon(type: string | null): LucideIcon {
	switch (type) {
		case "user":
			return User;
		case "comment":
			return MessageSquare;
		default:
			return FileText;
	}
}
