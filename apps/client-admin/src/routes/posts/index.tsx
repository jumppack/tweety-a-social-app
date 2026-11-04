import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Flag, Heart, MessageSquare, Search, Trash2, User } from "lucide-react";
import { useState } from "react";
import {
	DeleteContentDialog,
	type DeleteTarget,
} from "../../components/content/DeleteContentDialog";
import { formatDateTime, formatRelativeTime } from "../../components/content/format";
import { useContentList } from "../../components/content/useContentList";
import { requireAdminAccess } from "../../lib/auth-guard";
import { type AdminPost, type ContentListInput, listPosts } from "../../server/functions/content";
import { radii, semanticColors, spacing } from "../../tokens.stylex";

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
	postsList: {
		display: "flex",
		flexDirection: "column",
		gap: spacing.md,
	},
	postCard: {
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.lg,
		border: `1px solid ${semanticColors.borderSubtle}`,
		padding: spacing.lg,
	},
	postHeader: {
		display: "flex",
		alignItems: "flex-start",
		justifyContent: "space-between",
		marginBottom: spacing.md,
	},
	authorSection: {
		display: "flex",
		alignItems: "center",
		gap: spacing.md,
	},
	avatar: {
		width: "40px",
		height: "40px",
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
		fontSize: "0.875rem",
		textDecoration: "none",
		":hover": {
			textDecoration: "underline",
		},
	},
	authorHandle: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
	postActions: {
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
	postContent: {
		color: semanticColors.textSecondary,
		fontSize: "0.9375rem",
		lineHeight: 1.6,
		marginBottom: spacing.md,
		whiteSpace: "pre-wrap",
		overflowWrap: "anywhere",
	},
	postFooter: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
	},
	postStats: {
		display: "flex",
		alignItems: "center",
		gap: spacing.lg,
	},
	stat: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		color: semanticColors.textTertiary,
		fontSize: "0.875rem",
	},
	postTime: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
	flagged: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		color: semanticColors.warning,
		fontSize: "0.75rem",
	},
	message: {
		padding: spacing.xl,
		textAlign: "center",
		color: semanticColors.textTertiary,
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.lg,
		border: `1px solid ${semanticColors.borderSubtle}`,
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

export const Route = createFileRoute("/posts/")({
	beforeLoad: requireAdminAccess,
	component: PostsPage,
});

type Filter = "all" | "reported" | "recent";

const fetchPosts = async (input: ContentListInput) => {
	const { posts, total } = await listPosts({ data: input });
	return { items: posts, total };
};

function PostsPage() {
	const list = useContentList<AdminPost>(fetchPosts);
	const [filter, setFilter] = useState<Filter>("all");
	const [deleting, setDeleting] = useState<DeleteTarget | null>(null);

	const onFilterChange = (value: Filter) => {
		setFilter(value);
		// The API always returns newest first, so "Most Recent" is the default order
		list.setReportedOnly(value === "reported");
	};

	const emptyMessage = list.search
		? `No posts match "${list.search}"`
		: list.reportedOnly
			? "No reported posts"
			: "No posts found";

	return (
		<main {...stylex.props(styles.container)}>
			<header {...stylex.props(styles.header)}>
				<h1 {...stylex.props(styles.title)}>Posts</h1>
				<div {...stylex.props(styles.filters)}>
					<select
						aria-label="Filter posts"
						value={filter}
						onChange={(e) => onFilterChange(e.target.value as Filter)}
						{...stylex.props(styles.filterSelect)}
					>
						<option value="all">All Posts</option>
						<option value="reported">Reported Only</option>
						<option value="recent">Most Recent</option>
					</select>
					<div {...stylex.props(styles.searchContainer)}>
						<Search size={16} {...stylex.props(styles.searchIcon)} />
						<input
							type="search"
							placeholder="Search posts..."
							aria-label="Search posts"
							value={list.search}
							onChange={(e) => list.setSearch(e.target.value)}
							{...stylex.props(styles.searchInput)}
						/>
					</div>
				</div>
			</header>

			{list.loading || list.error || list.items.length === 0 ? (
				<p role={list.error ? "alert" : "status"} {...stylex.props(styles.message)}>
					{list.loading ? "Loading posts…" : list.error ? list.error : emptyMessage}
				</p>
			) : (
				<div {...stylex.props(styles.postsList)}>
					{list.items.map((post) => (
						<article
							key={post.id}
							aria-label={`Post by @${post.authorUsername}`}
							data-post-id={post.id}
							{...stylex.props(styles.postCard)}
						>
							<div {...stylex.props(styles.postHeader)}>
								<div {...stylex.props(styles.authorSection)}>
									<div {...stylex.props(styles.avatar)}>
										<User size={20} />
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
								<div {...stylex.props(styles.postActions)}>
									<Link
										to="/posts/$postId"
										params={{ postId: post.id }}
										title="View post"
										aria-label={`View post by @${post.authorUsername}`}
										{...stylex.props(styles.actionButton, styles.viewLink)}
									>
										<Eye size={16} />
									</Link>
									<button
										type="button"
										title="Delete post"
										aria-label={`Delete post by @${post.authorUsername}`}
										onClick={() =>
											setDeleting({
												kind: "post",
												id: post.id,
												content: post.content,
												authorUsername: post.authorUsername,
											})
										}
										{...stylex.props(styles.actionButton, styles.deleteButton)}
									>
										<Trash2 size={16} />
									</button>
								</div>
							</div>

							<p {...stylex.props(styles.postContent)}>{post.content}</p>

							<div {...stylex.props(styles.postFooter)}>
								<div {...stylex.props(styles.postStats)}>
									<span {...stylex.props(styles.stat)} title="Likes">
										<Heart size={14} /> {post.likeCount}
									</span>
									<span {...stylex.props(styles.stat)} title="Comments">
										<MessageSquare size={14} /> {post.commentCount}
									</span>
									{post.reportCount > 0 && (
										<span {...stylex.props(styles.flagged)} title="Pending reports">
											<Flag size={14} /> {post.reportCount}{" "}
											{post.reportCount === 1 ? "report" : "reports"}
										</span>
									)}
								</div>
								<time
									dateTime={new Date(post.createdAt).toISOString()}
									title={formatDateTime(post.createdAt)}
									{...stylex.props(styles.postTime)}
								>
									{formatRelativeTime(post.createdAt)}
								</time>
							</div>
						</article>
					))}
				</div>
			)}

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
