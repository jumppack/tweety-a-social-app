import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	Calendar,
	Flag,
	Heart,
	MessageSquare,
	Trash2,
	User,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
	DeleteContentDialog,
	type DeleteTarget,
} from "../../components/content/DeleteContentDialog";
import { formatDateTime, formatRelativeTime } from "../../components/content/format";
import { requireAdminAccess } from "../../lib/auth-guard";
import { getPost, type ReportStatus } from "../../server/functions/content";
import { colors, radii, semanticColors, spacing } from "../../tokens.stylex";

// Colours come from semanticColors (light/dark aware). The mockup hardcoded a
// dark slate palette, which made this page unreadable on the light theme.
const styles = stylex.create({
	container: {
		maxWidth: "1000px",
		marginInline: "auto",
		paddingInline: spacing.lg,
		paddingBlock: spacing.xl,
	},
	backLink: {
		display: "inline-flex",
		alignItems: "center",
		gap: spacing.sm,
		color: semanticColors.textTertiary,
		textDecoration: "none",
		fontSize: "0.875rem",
		marginBottom: spacing.lg,
		":hover": {
			color: semanticColors.textPrimary,
		},
	},
	card: {
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.lg,
		border: `1px solid ${semanticColors.borderSubtle}`,
		overflow: "hidden",
		marginBottom: spacing.lg,
	},
	cardHeader: {
		padding: spacing.lg,
		borderBottom: `1px solid ${semanticColors.borderSubtle}`,
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
	},
	cardTitle: {
		fontSize: "1.125rem",
		fontWeight: 600,
		color: semanticColors.textPrimary,
	},
	cardContent: {
		padding: spacing.lg,
	},
	authorSection: {
		display: "flex",
		alignItems: "center",
		gap: spacing.md,
		marginBottom: spacing.lg,
	},
	avatar: {
		width: "48px",
		height: "48px",
		borderRadius: "50%",
		backgroundColor: semanticColors.bgSecondary,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: semanticColors.textTertiary,
	},
	authorInfo: {
		display: "flex",
		flexDirection: "column",
	},
	authorName: {
		color: semanticColors.textPrimary,
		fontWeight: 500,
		textDecoration: "none",
		":hover": {
			textDecoration: "underline",
		},
	},
	authorHandle: {
		color: semanticColors.textTertiary,
		fontSize: "0.875rem",
	},
	postContent: {
		color: semanticColors.textSecondary,
		fontSize: "1.125rem",
		lineHeight: 1.7,
		marginBottom: spacing.lg,
		whiteSpace: "pre-wrap",
		overflowWrap: "anywhere",
	},
	postMeta: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: spacing.lg,
		paddingTop: spacing.md,
		borderTop: `1px solid ${semanticColors.borderSubtle}`,
	},
	metaItem: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		color: semanticColors.textTertiary,
		fontSize: "0.875rem",
	},
	flagged: {
		color: semanticColors.warning,
	},
	deleteButton: {
		display: "flex",
		alignItems: "center",
		gap: spacing.sm,
		paddingInline: spacing.md,
		paddingBlock: spacing.sm,
		borderRadius: radii.md,
		border: "none",
		backgroundColor: colors.red600,
		color: colors.white,
		fontSize: "0.875rem",
		fontWeight: 500,
		cursor: "pointer",
		":hover": {
			backgroundColor: colors.red700,
		},
	},
	reportItem: {
		padding: spacing.md,
		borderBottom: `1px solid ${semanticColors.borderSubtle}`,
	},
	reportItemLast: {
		borderBottom: "none",
	},
	reportHeader: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.md,
		marginBottom: spacing.sm,
	},
	reportHeading: {
		display: "flex",
		alignItems: "center",
		gap: spacing.sm,
	},
	reportReason: {
		color: semanticColors.textPrimary,
		fontWeight: 500,
		fontSize: "0.875rem",
	},
	reportTime: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
	reportUser: {
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
	},
	reportDescription: {
		marginTop: spacing.xs,
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
		whiteSpace: "pre-wrap",
	},
	statusBadge: {
		display: "inline-flex",
		alignItems: "center",
		paddingInline: spacing.sm,
		paddingBlock: "2px",
		borderRadius: radii.full,
		fontSize: "0.75rem",
		fontWeight: 500,
		textTransform: "capitalize",
		border: "1px solid currentColor",
	},
	statusPending: {
		color: semanticColors.warning,
	},
	statusActioned: {
		color: semanticColors.error,
	},
	statusResolved: {
		color: semanticColors.textTertiary,
	},
	emptyState: {
		textAlign: "center",
		color: semanticColors.textTertiary,
		paddingBlock: spacing.lg,
	},
	comment: {
		padding: spacing.md,
		borderBottom: `1px solid ${semanticColors.borderSubtle}`,
	},
	commentLast: {
		borderBottom: "none",
	},
	commentHeader: {
		display: "flex",
		alignItems: "center",
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	commentAvatar: {
		width: "24px",
		height: "24px",
		borderRadius: "50%",
		backgroundColor: semanticColors.bgSecondary,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: semanticColors.textTertiary,
	},
	commentAuthor: {
		color: semanticColors.textPrimary,
		fontWeight: 500,
		fontSize: "0.875rem",
		textDecoration: "none",
		":hover": {
			textDecoration: "underline",
		},
	},
	commentHandle: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
	commentTime: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
	commentFlag: {
		display: "inline-flex",
		alignItems: "center",
		gap: "2px",
		color: semanticColors.warning,
		fontSize: "0.75rem",
	},
	commentDelete: {
		marginLeft: "auto",
		padding: spacing.xs,
		borderRadius: radii.md,
		border: "none",
		backgroundColor: "transparent",
		color: semanticColors.textTertiary,
		cursor: "pointer",
		":hover": {
			backgroundColor: semanticColors.errorBg,
			color: semanticColors.error,
		},
	},
	commentContent: {
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
		whiteSpace: "pre-wrap",
		overflowWrap: "anywhere",
	},
	centered: {
		padding: spacing["3xl"],
		textAlign: "center",
		color: semanticColors.textTertiary,
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: spacing.sm,
	},
	notFoundTitle: {
		fontSize: "1.25rem",
		fontWeight: 600,
		color: semanticColors.textPrimary,
	},
});

export const Route = createFileRoute("/posts/$postId")({
	beforeLoad: requireAdminAccess,
	component: PostDetailPage,
});

type Details = NonNullable<Awaited<ReturnType<typeof getPost>>>;

function statusStyle(status: ReportStatus) {
	if (status === "pending") return styles.statusPending;
	if (status === "actioned") return styles.statusActioned;
	return styles.statusResolved;
}

function PostDetailPage() {
	const { postId } = Route.useParams();
	const navigate = useNavigate();
	const [details, setDetails] = useState<Details | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

	const load = useCallback(async () => {
		try {
			setDetails(await getPost({ data: postId }));
			setError("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load post");
		} finally {
			setLoading(false);
		}
	}, [postId]);

	useEffect(() => {
		setLoading(true);
		load();
	}, [load]);

	const backLink = (
		<Link to="/posts" {...stylex.props(styles.backLink)}>
			<ArrowLeft size={16} />
			Back to Posts
		</Link>
	);

	// Keeps the "Post Details" title on every state so the page reads the same
	// while loading, after an error, or for an unknown id.
	const statusCard = (children: ReactNode) => (
		<main {...stylex.props(styles.container)}>
			{backLink}
			<div {...stylex.props(styles.card)}>
				<div {...stylex.props(styles.cardHeader)}>
					<h1 {...stylex.props(styles.cardTitle)}>Post Details</h1>
				</div>
				<div {...stylex.props(styles.centered)}>{children}</div>
			</div>
		</main>
	);

	if (loading) {
		return statusCard(<p>Loading post…</p>);
	}

	if (error || !details) {
		return statusCard(
			<>
				<AlertCircle size={32} />
				<h2 {...stylex.props(styles.notFoundTitle)}>
					{error ? "Couldn't load post" : "Post not found"}
				</h2>
				<p>{error || "This post may have been deleted or the link is wrong."}</p>
			</>,
		);
	}

	const { post, comments, reports } = details;
	const pendingReports = reports.filter((r) => r.status === "pending").length;

	const afterDelete = () => {
		const target = deleting;
		setDeleting(null);
		if (target?.kind === "post") {
			navigate({ to: "/posts" });
			return;
		}
		if (target) {
			// Drop the comment locally; the server has already confirmed it
			setDetails((d) =>
				d
					? {
							...d,
							post: { ...d.post, commentCount: Math.max(0, d.post.commentCount - 1) },
							comments: d.comments.filter((c) => c.id !== target.id),
						}
					: d,
			);
		}
	};

	return (
		<main {...stylex.props(styles.container)}>
			{backLink}

			<div {...stylex.props(styles.card)}>
				<div {...stylex.props(styles.cardHeader)}>
					<h1 {...stylex.props(styles.cardTitle)}>Post Details</h1>
					<button
						type="button"
						onClick={() =>
							setDeleting({
								kind: "post",
								id: post.id,
								content: post.content,
								authorUsername: post.authorUsername,
							})
						}
						{...stylex.props(styles.deleteButton)}
					>
						<Trash2 size={16} />
						Delete Post
					</button>
				</div>
				<div {...stylex.props(styles.cardContent)}>
					<div {...stylex.props(styles.authorSection)}>
						<div {...stylex.props(styles.avatar)}>
							<User size={24} />
						</div>
						<div {...stylex.props(styles.authorInfo)}>
							<Link
								to="/users/$userId"
								params={{ userId: post.authorId }}
								{...stylex.props(styles.authorName)}
							>
								{post.authorDisplayName}
							</Link>
							<span {...stylex.props(styles.authorHandle)}>@{post.authorUsername}</span>
						</div>
					</div>

					<p {...stylex.props(styles.postContent)}>{post.content}</p>

					<div {...stylex.props(styles.postMeta)}>
						<span {...stylex.props(styles.metaItem)}>
							<Heart size={14} /> {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}
						</span>
						<span {...stylex.props(styles.metaItem)}>
							<MessageSquare size={14} /> {post.commentCount}{" "}
							{post.commentCount === 1 ? "comment" : "comments"}
						</span>
						<span {...stylex.props(styles.metaItem)}>
							<Calendar size={14} />
							<time dateTime={new Date(post.createdAt).toISOString()}>
								{formatDateTime(post.createdAt)}
							</time>
						</span>
						{pendingReports > 0 && (
							<span {...stylex.props(styles.metaItem, styles.flagged)}>
								<Flag size={14} /> {pendingReports} pending{" "}
								{pendingReports === 1 ? "report" : "reports"}
							</span>
						)}
					</div>
				</div>
			</div>

			<section aria-labelledby="post-reports" {...stylex.props(styles.card)}>
				<div {...stylex.props(styles.cardHeader)}>
					<h2 id="post-reports" {...stylex.props(styles.cardTitle)}>
						Reports ({reports.length})
					</h2>
				</div>
				<div>
					{reports.length === 0 ? (
						<p {...stylex.props(styles.emptyState)}>No reports for this post</p>
					) : (
						reports.map((report, index) => {
							const isLast = index === reports.length - 1;
							return (
								<div
									key={report.id}
									data-report-id={report.id}
									{...stylex.props(styles.reportItem, isLast && styles.reportItemLast)}
								>
									<div {...stylex.props(styles.reportHeader)}>
										<div {...stylex.props(styles.reportHeading)}>
											<span {...stylex.props(styles.reportReason)}>{report.reason}</span>
											<span {...stylex.props(styles.statusBadge, statusStyle(report.status))}>
												{report.status}
											</span>
										</div>
										<time
											dateTime={new Date(report.createdAt).toISOString()}
											title={formatDateTime(report.createdAt)}
											{...stylex.props(styles.reportTime)}
										>
											{formatRelativeTime(report.createdAt)}
										</time>
									</div>
									<span {...stylex.props(styles.reportUser)}>
										Reported by @{report.reporterUsername}
									</span>
									{report.description && (
										<p {...stylex.props(styles.reportDescription)}>{report.description}</p>
									)}
								</div>
							);
						})
					)}
				</div>
			</section>

			<section aria-labelledby="post-comments" {...stylex.props(styles.card)}>
				<div {...stylex.props(styles.cardHeader)}>
					<h2 id="post-comments" {...stylex.props(styles.cardTitle)}>
						Comments ({comments.length})
					</h2>
				</div>
				<div>
					{comments.length === 0 ? (
						<p {...stylex.props(styles.emptyState)}>No comments on this post</p>
					) : (
						comments.map((comment, index) => {
							const isLast = index === comments.length - 1;
							return (
								<div
									key={comment.id}
									data-comment-id={comment.id}
									{...stylex.props(styles.comment, isLast && styles.commentLast)}
								>
									<div {...stylex.props(styles.commentHeader)}>
										<div {...stylex.props(styles.commentAvatar)}>
											<User size={12} />
										</div>
										<Link
											to="/users/$userId"
											params={{ userId: comment.authorId }}
											{...stylex.props(styles.commentAuthor)}
										>
											{comment.authorDisplayName}
										</Link>
										<span {...stylex.props(styles.commentHandle)}>@{comment.authorUsername}</span>
										<time
											dateTime={new Date(comment.createdAt).toISOString()}
											title={formatDateTime(comment.createdAt)}
											{...stylex.props(styles.commentTime)}
										>
											{formatRelativeTime(comment.createdAt)}
										</time>
										{comment.reportCount > 0 && (
											<span {...stylex.props(styles.commentFlag)} title="Pending reports">
												<Flag size={12} /> {comment.reportCount}
											</span>
										)}
										<button
											type="button"
											title="Delete comment"
											aria-label={`Delete comment by @${comment.authorUsername}`}
											onClick={() =>
												setDeleting({
													kind: "comment",
													id: comment.id,
													content: comment.content,
													authorUsername: comment.authorUsername,
												})
											}
											{...stylex.props(styles.commentDelete)}
										>
											<Trash2 size={14} />
										</button>
									</div>
									<p {...stylex.props(styles.commentContent)}>{comment.content}</p>
								</div>
							);
						})
					)}
				</div>
			</section>

			{deleting && (
				<DeleteContentDialog
					target={deleting}
					onClose={() => setDeleting(null)}
					onDone={afterDelete}
				/>
			)}
		</main>
	);
}
