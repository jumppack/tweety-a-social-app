import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CommentCard } from "../../components/comments/CommentCard";
import { CommentForm } from "../../components/comments/CommentForm";
import { PostCard } from "../../components/posts/PostCard";
import { LoadingSpinner } from "../../components/shared/LoadingSpinner";
import { getCurrentUser } from "../../server/functions/auth";
import { getPostComments } from "../../server/functions/comments";
import { getPost } from "../../server/functions/posts";
import { colors, radii, semanticColors, shadows, spacing } from "../../tokens.stylex";

// This page used Tailwind class names, but Tailwind is not installed in this
// app, so none of them applied and the page rendered unstyled. These StyleX
// styles reproduce the intended layout using the shared design tokens.
const styles = stylex.create({
	container: {
		maxWidth: "42rem",
		marginLeft: "auto",
		marginRight: "auto",
		paddingLeft: spacing.lg,
		paddingRight: spacing.lg,
		paddingTop: spacing["2xl"],
		paddingBottom: spacing["3xl"],
	},
	loadingContainer: {
		paddingTop: spacing["4xl"],
		paddingBottom: spacing["4xl"],
	},
	header: {
		display: "flex",
		alignItems: "center",
		gap: spacing.lg,
		marginBottom: spacing["2xl"],
	},
	backLink: {
		display: "flex",
		padding: spacing.sm,
		borderRadius: radii.lg,
		color: semanticColors.textSecondary,
		transition: "background-color 0.15s",
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
	},
	title: {
		fontSize: "1.25rem",
		fontWeight: 700,
		color: semanticColors.textPrimary,
		letterSpacing: "-0.025em",
	},
	subtitle: {
		fontSize: "0.75rem",
		color: semanticColors.textSecondary,
	},
	card: {
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.xl,
		boxShadow: shadows.card,
		overflow: "hidden",
	},
	commentsCard: {
		marginTop: spacing["2xl"],
	},
	commentsHeader: {
		padding: spacing.xl,
		borderBottomWidth: "1px",
		borderBottomStyle: "solid",
		borderBottomColor: semanticColors.borderLight,
	},
	commentsTitleRow: {
		display: "flex",
		alignItems: "center",
		gap: spacing.md,
	},
	commentsIcon: {
		width: "2.25rem",
		height: "2.25rem",
		flexShrink: 0,
		borderRadius: radii.lg,
		backgroundImage: `linear-gradient(135deg, ${colors.blue500}, ${colors.cyan500})`,
		color: colors.white,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	sectionTitle: {
		fontSize: "1rem",
		fontWeight: 700,
		color: semanticColors.textPrimary,
	},
	signInPrompt: {
		marginTop: spacing.lg,
		padding: spacing.lg,
		borderRadius: radii.lg,
		backgroundColor: semanticColors.bgSecondary,
		textAlign: "center",
		fontSize: "0.875rem",
		color: semanticColors.textSecondary,
	},
	link: {
		color: colors.indigo500,
		fontWeight: 600,
		textDecoration: "none",
		":hover": {
			color: colors.indigo600,
		},
	},
	commentsList: {
		paddingLeft: spacing.xl,
		paddingRight: spacing.xl,
	},
	reply: {
		marginLeft: spacing["2xl"],
		paddingLeft: spacing.lg,
		borderLeftWidth: "2px",
		borderLeftStyle: "solid",
		borderLeftColor: semanticColors.borderLight,
	},
	emptyState: {
		paddingTop: spacing["3xl"],
		paddingBottom: spacing["3xl"],
		textAlign: "center",
	},
	emptyIcon: {
		width: "3rem",
		height: "3rem",
		borderRadius: radii.full,
		backgroundColor: semanticColors.bgSecondary,
		color: semanticColors.textTertiary,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		marginLeft: "auto",
		marginRight: "auto",
		marginBottom: spacing.md,
	},
	emptyTitle: {
		color: semanticColors.textSecondary,
	},
	emptyText: {
		marginTop: spacing.xs,
		fontSize: "0.875rem",
		color: semanticColors.textTertiary,
	},
	notFound: {
		padding: spacing["3xl"],
		textAlign: "center",
	},
	notFoundIcon: {
		width: "4rem",
		height: "4rem",
		borderRadius: radii.xl,
		backgroundColor: colors.red50,
		color: colors.red500,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		marginLeft: "auto",
		marginRight: "auto",
		marginBottom: spacing.lg,
	},
	notFoundTitle: {
		fontSize: "1.125rem",
		fontWeight: 600,
		color: semanticColors.textPrimary,
		marginBottom: spacing.sm,
	},
	notFoundText: {
		color: semanticColors.textSecondary,
		marginBottom: spacing["2xl"],
	},
	homeButton: {
		display: "inline-flex",
		alignItems: "center",
		gap: spacing.sm,
		paddingTop: spacing.md,
		paddingBottom: spacing.md,
		paddingLeft: spacing.xl,
		paddingRight: spacing.xl,
		borderRadius: radii.full,
		backgroundImage: `linear-gradient(90deg, ${colors.blue500}, ${colors.blue600})`,
		color: colors.white,
		fontWeight: 600,
		textDecoration: "none",
		boxShadow: "0 10px 15px -3px rgba(59, 130, 246, 0.25)",
	},
});

export const Route = createFileRoute("/posts/$postId")({
	component: PostPage,
});

function PostPage() {
	const { postId } = Route.useParams();
	const [post, setPost] = useState<any>(null);
	const [comments, setComments] = useState<any[]>([]);
	const [user, setUser] = useState<any>(null);
	const [loading, setLoading] = useState(true);

	const loadData = useCallback(async () => {
		try {
			const [currentUser, postData, commentsData] = await Promise.all([
				getCurrentUser(),
				getPost({ data: postId }),
				getPostComments({ data: postId }),
			]);
			setUser(currentUser);
			setPost(postData);
			setComments(commentsData);
		} catch (error) {
			console.error("Failed to load post:", error);
		} finally {
			setLoading(false);
		}
	}, [postId]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	if (loading) {
		return (
			<div {...stylex.props(styles.container, styles.loadingContainer)}>
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	if (!post) {
		return (
			<div {...stylex.props(styles.container)}>
				<div {...stylex.props(styles.card, styles.notFound)}>
					<div {...stylex.props(styles.notFoundIcon)}>
						<AlertCircle size={32} />
					</div>
					<h3 {...stylex.props(styles.notFoundTitle)}>Post not found</h3>
					<p {...stylex.props(styles.notFoundText)}>
						This post may have been deleted or doesn't exist.
					</p>
					<Link to="/" {...stylex.props(styles.homeButton)}>
						<ArrowLeft size={16} />
						Back to Home
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div {...stylex.props(styles.container)}>
			{/* Page Header */}
			<div {...stylex.props(styles.header)}>
				<Link to="/" {...stylex.props(styles.backLink)} title="Go back">
					<ArrowLeft size={20} />
				</Link>
				<div>
					<h1 {...stylex.props(styles.title)}>Post</h1>
					<p {...stylex.props(styles.subtitle)}>View post and comments</p>
				</div>
			</div>

			{/* Post */}
			<PostCard post={post} currentUserId={user?.id} onDelete={() => window.history.back()} />

			{/* Comments Section */}
			<div {...stylex.props(styles.card, styles.commentsCard)}>
				<div {...stylex.props(styles.commentsHeader)}>
					<div {...stylex.props(styles.commentsTitleRow)}>
						<div {...stylex.props(styles.commentsIcon)}>
							<MessageCircle size={18} />
						</div>
						<div>
							<h2 {...stylex.props(styles.sectionTitle)}>Comments</h2>
							<p {...stylex.props(styles.subtitle)}>
								{comments.length} {comments.length === 1 ? "comment" : "comments"}
							</p>
						</div>
					</div>

					{user && <CommentForm postId={postId} onSuccess={loadData} />}

					{!user && (
						<div {...stylex.props(styles.signInPrompt)}>
							<Link to="/auth/login" {...stylex.props(styles.link)}>
								Sign in
							</Link>{" "}
							to leave a comment
						</div>
					)}
				</div>

				{/* Comments List */}
				<div {...stylex.props(styles.commentsList)}>
					{comments.length === 0 ? (
						<div {...stylex.props(styles.emptyState)}>
							<div {...stylex.props(styles.emptyIcon)}>
								<MessageCircle size={24} />
							</div>
							<p {...stylex.props(styles.emptyTitle)}>No comments yet</p>
							<p {...stylex.props(styles.emptyText)}>Be the first to comment!</p>
						</div>
					) : (
						<div>
							{comments.map((comment) => (
								<div key={comment.id}>
									<CommentCard comment={comment} currentUserId={user?.id} onDelete={loadData} />
									{comment.replies?.map((reply: any) => (
										<div key={reply.id} {...stylex.props(styles.reply)}>
											<CommentCard comment={reply} currentUserId={user?.id} onDelete={loadData} />
										</div>
									))}
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
