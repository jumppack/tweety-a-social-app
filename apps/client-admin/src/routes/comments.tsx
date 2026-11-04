import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Eye, Flag, Search, Trash2, User } from "lucide-react";
import { useState } from "react";
import { DeleteContentDialog, type DeleteTarget } from "../components/content/DeleteContentDialog";
import { formatDateTime, formatRelativeTime } from "../components/content/format";
import { useContentList } from "../components/content/useContentList";
import { requireAdminAccess } from "../lib/auth-guard";
import {
	type AdminComment,
	type ContentListInput,
	listComments,
} from "../server/functions/content";
import { radii, semanticColors, spacing } from "../tokens.stylex";

const styles = stylex.create({
	container: {
		maxWidth: "1400px",
		marginInline: "auto",
		paddingInline: spacing.lg,
		paddingBlock: spacing.xl,
	},
	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: spacing.xl,
	},
	title: {
		fontSize: "1.875rem",
		fontWeight: 700,
		color: semanticColors.textPrimary,
	},
	filters: {
		display: "flex",
		alignItems: "center",
		gap: spacing.md,
	},
	searchContainer: {
		position: "relative",
		width: "300px",
	},
	searchIcon: {
		position: "absolute",
		left: spacing.md,
		top: "50%",
		transform: "translateY(-50%)",
		color: semanticColors.textTertiary,
	},
	searchInput: {
		width: "100%",
		paddingBlock: spacing.sm,
		paddingLeft: "40px",
		paddingRight: spacing.md,
		borderRadius: radii.md,
		border: `1px solid ${semanticColors.borderDefault}`,
		backgroundColor: semanticColors.surfaceInput,
		color: semanticColors.textPrimary,
		fontSize: "0.875rem",
		"::placeholder": {
			color: semanticColors.textTertiary,
		},
		":focus": {
			outline: "none",
			borderColor: semanticColors.borderFocus,
		},
	},
	filterSelect: {
		paddingBlock: spacing.sm,
		paddingInline: spacing.md,
		borderRadius: radii.md,
		border: `1px solid ${semanticColors.borderDefault}`,
		backgroundColor: semanticColors.surfaceInput,
		color: semanticColors.textPrimary,
		fontSize: "0.875rem",
		cursor: "pointer",
	},
	table: {
		width: "100%",
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.lg,
		border: `1px solid ${semanticColors.borderSubtle}`,
		overflow: "hidden",
	},
	tableHeader: {
		backgroundColor: semanticColors.bgSecondary,
	},
	tableRow: {
		borderBottom: `1px solid ${semanticColors.borderSubtle}`,
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
	},
	tableRowLast: {
		borderBottom: "none",
	},
	th: {
		textAlign: "left",
		padding: spacing.md,
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
		fontWeight: 600,
		textTransform: "uppercase",
		letterSpacing: "0.05em",
	},
	td: {
		padding: spacing.md,
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
	},
	userCell: {
		display: "flex",
		alignItems: "center",
		gap: spacing.sm,
	},
	avatar: {
		width: "32px",
		height: "32px",
		borderRadius: "50%",
		backgroundColor: semanticColors.bgSecondary,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: semanticColors.textTertiary,
	},
	userName: {
		color: semanticColors.textPrimary,
		fontWeight: 500,
		textDecoration: "none",
		":hover": {
			textDecoration: "underline",
		},
	},
	commentContent: {
		display: "block",
		maxWidth: "400px",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	postExcerpt: {
		display: "inline-block",
		maxWidth: "220px",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	},
	postLink: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		color: semanticColors.primary,
		textDecoration: "none",
		fontSize: "0.875rem",
		":hover": {
			textDecoration: "underline",
		},
	},
	flagged: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		color: semanticColors.warning,
	},
	actionsCell: {
		display: "flex",
		alignItems: "center",
		gap: spacing.sm,
	},
	actionButton: {
		padding: spacing.sm,
		borderRadius: radii.md,
		border: "none",
		backgroundColor: "transparent",
		color: semanticColors.textTertiary,
		cursor: "pointer",
		":hover": {
			backgroundColor: semanticColors.bgHover,
			color: semanticColors.textPrimary,
		},
	},
	viewLink: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		textDecoration: "none",
	},
	deleteButton: {
		":hover": {
			backgroundColor: semanticColors.errorBg,
			color: semanticColors.error,
		},
	},
	message: {
		padding: spacing.xl,
		textAlign: "center",
		color: semanticColors.textTertiary,
	},
	pager: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: spacing.lg,
		color: semanticColors.textTertiary,
		fontSize: "0.875rem",
	},
	loadMore: {
		paddingBlock: spacing.sm,
		paddingInline: spacing.lg,
		borderRadius: radii.md,
		border: `1px solid ${semanticColors.borderDefault}`,
		backgroundColor: semanticColors.surfaceCard,
		color: semanticColors.textPrimary,
		fontSize: "0.875rem",
		cursor: "pointer",
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
		":disabled": {
			opacity: 0.6,
			cursor: "not-allowed",
		},
	},
});

export const Route = createFileRoute("/comments")({
	beforeLoad: requireAdminAccess,
	component: CommentsPage,
});

type Filter = "all" | "reported" | "recent";

const fetchComments = async (input: ContentListInput) => {
	const { comments, total } = await listComments({ data: input });
	return { items: comments, total };
};

function CommentsPage() {
	const list = useContentList<AdminComment>(fetchComments);
	const [filter, setFilter] = useState<Filter>("all");
	const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

	const onFilterChange = (value: Filter) => {
		setFilter(value);
		// The API always returns newest first, so "Most Recent" is the default order
		list.setReportedOnly(value === "reported");
	};

	const emptyMessage = list.search
		? `No comments match "${list.search}"`
		: list.reportedOnly
			? "No reported comments"
			: "No comments found";

	return (
		<main {...stylex.props(styles.container)}>
			<header {...stylex.props(styles.header)}>
				<h1 {...stylex.props(styles.title)}>Comments</h1>
				<div {...stylex.props(styles.filters)}>
					<select
						aria-label="Filter comments"
						value={filter}
						onChange={(e) => onFilterChange(e.target.value as Filter)}
						{...stylex.props(styles.filterSelect)}
					>
						<option value="all">All Comments</option>
						<option value="reported">Reported Only</option>
						<option value="recent">Most Recent</option>
					</select>
					<div {...stylex.props(styles.searchContainer)}>
						<Search size={16} {...stylex.props(styles.searchIcon)} />
						<input
							type="search"
							placeholder="Search comments..."
							aria-label="Search comments"
							value={list.search}
							onChange={(e) => list.setSearch(e.target.value)}
							{...stylex.props(styles.searchInput)}
						/>
					</div>
				</div>
			</header>

			<table {...stylex.props(styles.table)}>
				<thead {...stylex.props(styles.tableHeader)}>
					<tr>
						<th {...stylex.props(styles.th)}>Author</th>
						<th {...stylex.props(styles.th)}>Comment</th>
						<th {...stylex.props(styles.th)}>Post</th>
						<th {...stylex.props(styles.th)}>Reports</th>
						<th {...stylex.props(styles.th)}>Date</th>
						<th {...stylex.props(styles.th)}>Actions</th>
					</tr>
				</thead>
				<tbody>
					{list.loading || list.error || list.items.length === 0 ? (
						<tr>
							<td
								colSpan={6}
								role={list.error ? "alert" : "status"}
								{...stylex.props(styles.message)}
							>
								{list.loading ? "Loading comments…" : list.error ? list.error : emptyMessage}
							</td>
						</tr>
					) : (
						list.items.map((comment, index) => {
							const isLast = index === list.items.length - 1;
							return (
								<tr
									key={comment.id}
									data-comment-id={comment.id}
									{...stylex.props(styles.tableRow, isLast && styles.tableRowLast)}
								>
									<td {...stylex.props(styles.td)}>
										<div {...stylex.props(styles.userCell)}>
											<div {...stylex.props(styles.avatar)}>
												<User size={16} />
											</div>
											<Link
												to="/users/$userId"
												params={{ userId: comment.authorId }}
												title={`@${comment.authorUsername}`}
												{...stylex.props(styles.userName)}
											>
												{comment.authorDisplayName}
											</Link>
										</div>
									</td>
									<td {...stylex.props(styles.td)}>
										<span title={comment.content} {...stylex.props(styles.commentContent)}>
											{comment.content}
										</span>
									</td>
									<td {...stylex.props(styles.td)}>
										<Link
											to="/posts/$postId"
											params={{ postId: comment.postId }}
											title={comment.postExcerpt}
											{...stylex.props(styles.postLink)}
										>
											<span {...stylex.props(styles.postExcerpt)}>
												{comment.postExcerpt || "(untitled post)"}
											</span>
											<ExternalLink size={12} />
										</Link>
									</td>
									<td {...stylex.props(styles.td)}>
										{comment.reportCount > 0 ? (
											<span {...stylex.props(styles.flagged)} title="Pending reports">
												<Flag size={14} /> {comment.reportCount}
											</span>
										) : (
											"-"
										)}
									</td>
									<td {...stylex.props(styles.td)}>
										<time
											dateTime={new Date(comment.createdAt).toISOString()}
											title={formatDateTime(comment.createdAt)}
										>
											{formatRelativeTime(comment.createdAt)}
										</time>
									</td>
									<td {...stylex.props(styles.td)}>
										<div {...stylex.props(styles.actionsCell)}>
											<Link
												to="/posts/$postId"
												params={{ postId: comment.postId }}
												title="View post"
												aria-label={`View post for comment by @${comment.authorUsername}`}
												{...stylex.props(styles.actionButton, styles.viewLink)}
											>
												<Eye size={16} />
											</Link>
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
												{...stylex.props(styles.actionButton, styles.deleteButton)}
											>
												<Trash2 size={16} />
											</button>
										</div>
									</td>
								</tr>
							);
						})
					)}
				</tbody>
			</table>

			{!list.loading && !list.error && list.items.length > 0 && (
				<div {...stylex.props(styles.pager)}>
					<span>
						Showing {list.items.length} of {list.total}
					</span>
					{list.hasMore && (
						<button
							type="button"
							onClick={list.loadMore}
							disabled={list.loadingMore}
							{...stylex.props(styles.loadMore)}
						>
							{list.loadingMore ? "Loading…" : "Load more"}
						</button>
					)}
				</div>
			)}

			{deleting && (
				<DeleteContentDialog
					target={deleting}
					onClose={() => setDeleting(null)}
					onDone={() => {
						list.remove(deleting.id);
						setDeleting(null);
					}}
				/>
			)}
		</main>
	);
}
