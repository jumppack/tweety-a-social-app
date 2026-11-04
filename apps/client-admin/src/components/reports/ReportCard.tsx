import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";
import { Ban, Check, Clock, Eye, FileText, MessageSquare, Trash2, User, X } from "lucide-react";
import type { AdminReport, ReviewAction } from "../../server/functions/reports";
import { colors, radii, semanticColors, spacing } from "../../tokens.stylex";

const styles = stylex.create({
	reportCard: {
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.lg,
		border: `1px solid ${semanticColors.borderSubtle}`,
		overflow: "hidden",
	},
	reportHeader: {
		padding: spacing.md,
		backgroundColor: semanticColors.bgSecondary,
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.md,
		flexWrap: "wrap",
	},
	reportInfo: {
		display: "flex",
		alignItems: "center",
		gap: spacing.md,
	},
	reportBadge: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		paddingInline: spacing.sm,
		paddingBlock: "4px",
		borderRadius: radii.full,
		fontSize: "0.75rem",
		fontWeight: 500,
	},
	badgePost: {
		backgroundColor: colors.blue900,
		color: colors.blue400,
	},
	badgeComment: {
		backgroundColor: "#581c87",
		color: "#c084fc",
	},
	badgeUser: {
		backgroundColor: colors.green900,
		color: colors.green400,
	},
	reportId: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
		fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
	},
	reportStatus: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		fontSize: "0.75rem",
		fontWeight: 500,
	},
	statusPending: {
		color: semanticColors.warning,
	},
	statusResolved: {
		color: semanticColors.success,
	},
	statusDismissed: {
		color: semanticColors.textTertiary,
	},
	reportContent: {
		padding: spacing.lg,
	},
	reportReason: {
		marginBottom: spacing.md,
	},
	reasonLabel: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
		marginBottom: spacing.xs,
	},
	reasonText: {
		color: semanticColors.textPrimary,
		fontWeight: 500,
	},
	descriptionText: {
		marginTop: spacing.xs,
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
		whiteSpace: "pre-wrap",
	},
	targetSection: {
		backgroundColor: semanticColors.bgSecondary,
		borderRadius: radii.md,
		padding: spacing.md,
		marginBottom: spacing.md,
	},
	targetHeader: {
		display: "flex",
		alignItems: "center",
		gap: spacing.sm,
		marginBottom: spacing.sm,
		color: semanticColors.textTertiary,
	},
	targetLabel: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
	targetContent: {
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
		whiteSpace: "pre-wrap",
		overflowWrap: "anywhere",
	},
	targetDeleted: {
		color: semanticColors.textTertiary,
		fontStyle: "italic",
	},
	inlineLink: {
		color: colors.blue400,
		textDecoration: "none",
		":hover": {
			textDecoration: "underline",
		},
	},
	reportMeta: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: spacing.lg,
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
	metaItem: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
	},
	reportFooter: {
		padding: spacing.md,
		borderTop: `1px solid ${semanticColors.borderSubtle}`,
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.md,
		flexWrap: "wrap",
	},
	viewLink: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		color: colors.blue400,
		textDecoration: "none",
		fontSize: "0.875rem",
		":hover": {
			textDecoration: "underline",
		},
	},
	noLink: {
		color: semanticColors.textTertiary,
		fontSize: "0.875rem",
	},
	actions: {
		display: "flex",
		gap: spacing.sm,
		flexWrap: "wrap",
	},
	actionButton: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		paddingInline: spacing.md,
		paddingBlock: spacing.sm,
		borderRadius: radii.md,
		border: "none",
		fontSize: "0.875rem",
		fontWeight: 500,
		cursor: "pointer",
		":disabled": {
			opacity: 0.5,
			cursor: "not-allowed",
		},
	},
	dismissButton: {
		backgroundColor: colors.slate700,
		color: colors.white,
		":hover": {
			backgroundColor: colors.slate600,
		},
	},
	removeButton: {
		backgroundColor: colors.green600,
		color: colors.white,
		":hover": {
			backgroundColor: colors.green700,
		},
	},
	banButton: {
		backgroundColor: colors.red600,
		color: colors.white,
		":hover": {
			backgroundColor: colors.red700,
		},
	},
	reviewedInfo: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
});

const TYPE_ICON = { post: FileText, comment: MessageSquare, user: User } as const;
const TYPE_BADGE = {
	post: styles.badgePost,
	comment: styles.badgeComment,
	user: styles.badgeUser,
} as const;

/** "actioned" is shown as "Resolved"; "reviewed" is never set by the API but is handled anyway. */
export const STATUS_LABEL: Record<AdminReport["status"], string> = {
	pending: "Pending",
	reviewed: "Reviewed",
	actioned: "Resolved",
	dismissed: "Dismissed",
};

export function timeAgo(date: Date, now = Date.now()): string {
	const seconds = Math.round((now - new Date(date).getTime()) / 1000);
	if (seconds < 45) return "just now";
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(date).toISOString().slice(0, 10);
}

function TimeAgo({ date }: { date: Date }) {
	const iso = new Date(date).toISOString();
	return (
		<time dateTime={iso} title={iso.replace("T", " ").slice(0, 16)}>
			{timeAgo(date)}
		</time>
	);
}

function TargetLink({ report }: { report: AdminReport }) {
	if (!report.targetExists) {
		return <span {...stylex.props(styles.noLink)}>No longer available</span>;
	}
	if (report.targetType === "user") {
		return (
			<Link
				to="/users/$userId"
				params={{ userId: report.targetId }}
				{...stylex.props(styles.viewLink)}
			>
				<Eye size={14} />
				View user
			</Link>
		);
	}
	const postId = report.targetType === "post" ? report.targetId : report.targetPostId;
	if (!postId) return null;
	return (
		<Link to="/posts/$postId" params={{ postId }} {...stylex.props(styles.viewLink)}>
			<Eye size={14} />
			{report.targetType === "post" ? "View post" : "View comment on post"}
		</Link>
	);
}

export function ReportCard({
	report,
	actorId,
	onAction,
}: {
	report: AdminReport;
	actorId: string | null;
	onAction: (action: ReviewAction) => void;
}) {
	const TargetIcon = TYPE_ICON[report.targetType] ?? User;
	const isPending = report.status === "pending";
	const isContent = report.targetType !== "user";
	const reporter = `@${report.reporterUsername}`;
	const author = report.targetAuthorUsername ? `@${report.targetAuthorUsername}` : null;
	const StatusIcon = isPending ? Clock : report.status === "dismissed" ? X : Check;
	const statusStyle = isPending
		? styles.statusPending
		: report.status === "dismissed"
			? styles.statusDismissed
			: styles.statusResolved;

	const canBan = report.targetExists && !!report.targetAuthorId;
	const banBlockedReason = !canBan
		? "The reported content no longer exists"
		: report.targetAuthorId === actorId
			? "You cannot ban yourself"
			: null;

	return (
		<article
			aria-label={`Report on ${report.targetType} from ${reporter}`}
			data-report-id={report.id}
			data-status={report.status}
			{...stylex.props(styles.reportCard)}
		>
			<div {...stylex.props(styles.reportHeader)}>
				<div {...stylex.props(styles.reportInfo)}>
					<span {...stylex.props(styles.reportBadge, TYPE_BADGE[report.targetType])}>
						<TargetIcon size={12} />
						{report.targetType}
					</span>
					<span {...stylex.props(styles.reportId)} title={report.id}>
						Report #{report.id.slice(-8)}
					</span>
				</div>
				<div {...stylex.props(styles.reportStatus, statusStyle)} data-testid="report-status">
					<StatusIcon size={12} />
					{STATUS_LABEL[report.status] ?? report.status}
				</div>
			</div>

			<div {...stylex.props(styles.reportContent)}>
				<div {...stylex.props(styles.reportReason)}>
					<div {...stylex.props(styles.reasonLabel)}>Reason</div>
					<div {...stylex.props(styles.reasonText)}>{report.reason}</div>
					{report.description && (
						<p {...stylex.props(styles.descriptionText)}>{report.description}</p>
					)}
				</div>

				<div {...stylex.props(styles.targetSection)}>
					<div {...stylex.props(styles.targetHeader)}>
						<TargetIcon size={14} />
						<span {...stylex.props(styles.targetLabel)}>
							Reported {report.targetType}
							{isContent && author && report.targetAuthorId && (
								<>
									{" by "}
									<Link
										to="/users/$userId"
										params={{ userId: report.targetAuthorId }}
										{...stylex.props(styles.inlineLink)}
									>
										{author}
									</Link>
								</>
							)}
						</span>
					</div>
					{report.targetExists ? (
						<p {...stylex.props(styles.targetContent)}>{report.targetPreview}</p>
					) : (
						<p {...stylex.props(styles.targetContent, styles.targetDeleted)}>
							{isContent ? "Content was deleted" : "User no longer exists"}
						</p>
					)}
				</div>

				<div {...stylex.props(styles.reportMeta)}>
					<span {...stylex.props(styles.metaItem)}>
						<User size={12} />
						Reported by{" "}
						<Link
							to="/users/$userId"
							params={{ userId: report.reporterId }}
							{...stylex.props(styles.inlineLink)}
						>
							{reporter}
						</Link>
					</span>
					<span {...stylex.props(styles.metaItem)}>
						<Clock size={12} />
						<TimeAgo date={report.createdAt} />
					</span>
				</div>
			</div>

			<div {...stylex.props(styles.reportFooter)}>
				<TargetLink report={report} />

				{isPending ? (
					<div {...stylex.props(styles.actions)}>
						<button
							type="button"
							aria-label={`Dismiss report from ${reporter}`}
							onClick={() => onAction("dismiss")}
							{...stylex.props(styles.actionButton, styles.dismissButton)}
						>
							<X size={14} />
							Dismiss
						</button>
						{isContent && (
							<button
								type="button"
								aria-label={
									report.targetExists
										? `Remove ${report.targetType} reported by ${reporter}`
										: `Mark report from ${reporter} resolved`
								}
								onClick={() => onAction("remove_content")}
								{...stylex.props(styles.actionButton, styles.removeButton)}
							>
								{report.targetExists ? <Trash2 size={14} /> : <Check size={14} />}
								{report.targetExists ? "Remove content" : "Mark resolved"}
							</button>
						)}
						{canBan && (
							<button
								type="button"
								aria-label={`Ban ${author ?? "author"} (reported by ${reporter})`}
								title={banBlockedReason ?? undefined}
								disabled={!!banBlockedReason}
								onClick={() => onAction("ban_user")}
								{...stylex.props(styles.actionButton, styles.banButton)}
							>
								<Ban size={14} />
								{isContent ? "Ban author" : "Ban user"}
							</button>
						)}
					</div>
				) : (
					<span {...stylex.props(styles.reviewedInfo)}>
						{STATUS_LABEL[report.status] ?? report.status}
						{report.reviewedAt && (
							<>
								{" "}
								<TimeAgo date={report.reviewedAt} />
							</>
						)}
					</span>
				)}
			</div>
		</article>
	);
}
