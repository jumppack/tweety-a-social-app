import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	Ban,
	Calendar,
	Heart,
	Mail,
	MessageSquare,
	Shield,
	ShieldCheck,
	User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	BanUserDialog,
	ChangeRoleDialog,
	getPermissions,
} from "../../components/users/UserActionDialogs";
import { requireAdminAccess } from "../../lib/auth-guard";
import { getUserDetails } from "../../server/functions/users";
import { colors, radii, semanticColors, spacing } from "../../tokens.stylex";
import { useAdminUser } from "../__root";

// Colours come from semanticColors (light/dark aware) like the rest of the
// admin app. This page previously hardcoded a dark slate palette with white
// text, so on the light theme the name was invisible and the cards were dark.
const styles = stylex.create({
	container: {
		maxWidth: "1400px",
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
	header: {
		display: "flex",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: spacing.lg,
		flexWrap: "wrap",
		marginBottom: spacing.xl,
	},
	userSection: {
		display: "flex",
		alignItems: "center",
		gap: spacing.lg,
	},
	avatar: {
		width: "64px",
		height: "64px",
		borderRadius: "50%",
		backgroundColor: semanticColors.bgSecondary,
		color: semanticColors.textTertiary,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		flexShrink: 0,
	},
	avatarImg: {
		width: "100%",
		height: "100%",
		objectFit: "cover",
	},
	displayName: {
		fontSize: "1.5rem",
		fontWeight: 700,
		color: semanticColors.textPrimary,
	},
	username: {
		color: semanticColors.textTertiary,
		marginBottom: spacing.sm,
	},
	badges: {
		display: "flex",
		gap: spacing.sm,
	},
	badge: {
		display: "inline-flex",
		alignItems: "center",
		paddingInline: spacing.sm,
		paddingBlock: "2px",
		borderRadius: radii.full,
		fontSize: "0.75rem",
		fontWeight: 500,
	},
	badgeUser: {
		backgroundColor: semanticColors.bgSecondary,
		color: semanticColors.textSecondary,
	},
	badgeModerator: {
		backgroundColor: colors.blue100,
		color: colors.blue700,
	},
	badgeAdmin: {
		backgroundColor: "#f3e8ff",
		color: "#7e22ce",
	},
	badgeActive: {
		backgroundColor: "#dcfce7",
		color: colors.green700,
	},
	badgeBanned: {
		backgroundColor: semanticColors.errorBg,
		color: semanticColors.error,
	},
	actions: {
		display: "flex",
		gap: spacing.sm,
	},
	actionButton: {
		display: "inline-flex",
		alignItems: "center",
		gap: spacing.sm,
		paddingBlock: spacing.sm,
		paddingInline: spacing.md,
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
	roleButton: {
		backgroundColor: semanticColors.bgSecondary,
		color: semanticColors.textPrimary,
		border: `1px solid ${semanticColors.borderDefault}`,
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
	},
	banButton: {
		backgroundColor: colors.red600,
		color: colors.white,
		":hover": {
			backgroundColor: colors.red700,
		},
	},
	unbanButton: {
		backgroundColor: colors.green600,
		color: colors.white,
		":hover": {
			backgroundColor: colors.green700,
		},
	},
	banNotice: {
		display: "block",
		marginBottom: spacing.xl,
		padding: spacing.md,
		borderRadius: radii.md,
		border: `1px solid ${semanticColors.errorBorder}`,
		backgroundColor: semanticColors.errorBg,
		color: semanticColors.error,
		fontSize: "0.875rem",
	},
	grid: {
		display: "grid",
		gridTemplateColumns: {
			default: "1fr",
			"@media (min-width: 1024px)": "minmax(0, 1fr) minmax(0, 2fr)",
		},
		gap: spacing.lg,
		alignItems: "start",
	},
	sidebar: {
		display: "flex",
		flexDirection: "column",
		gap: spacing.lg,
	},
	card: {
		backgroundColor: semanticColors.surfaceCard,
		border: `1px solid ${semanticColors.borderSubtle}`,
		borderRadius: radii.lg,
		overflow: "hidden",
	},
	cardHeader: {
		paddingInline: spacing.lg,
		paddingBlock: spacing.md,
		borderBottom: `1px solid ${semanticColors.borderSubtle}`,
	},
	cardTitle: {
		fontSize: "1rem",
		fontWeight: 600,
		color: semanticColors.textPrimary,
	},
	cardContent: {
		padding: spacing.lg,
	},
	infoList: {
		display: "flex",
		flexDirection: "column",
		gap: spacing.md,
	},
	infoItem: {
		display: "flex",
		alignItems: "flex-start",
		gap: spacing.md,
	},
	infoIcon: {
		color: semanticColors.textTertiary,
		marginTop: "2px",
		flexShrink: 0,
	},
	infoLabel: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
	infoValue: {
		color: semanticColors.textPrimary,
		fontSize: "0.875rem",
		wordBreak: "break-all",
	},
	statsGrid: {
		display: "grid",
		gridTemplateColumns: "repeat(2, 1fr)",
		gap: spacing.md,
		textAlign: "center",
	},
	statValue: {
		fontSize: "1.5rem",
		fontWeight: 700,
		color: semanticColors.textPrimary,
	},
	statLabel: {
		fontSize: "0.75rem",
		color: semanticColors.textTertiary,
	},
	postItem: {
		paddingBlock: spacing.md,
		borderBottom: `1px solid ${semanticColors.borderSubtle}`,
		":first-child": {
			paddingTop: 0,
		},
		":last-child": {
			borderBottom: "none",
			paddingBottom: 0,
		},
	},
	postContent: {
		color: semanticColors.textPrimary,
		fontSize: "0.875rem",
		marginBottom: spacing.xs,
	},
	postMeta: {
		display: "flex",
		alignItems: "center",
		gap: spacing.md,
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
	postMetaItem: {
		display: "inline-flex",
		alignItems: "center",
		gap: "4px",
	},
	muted: {
		color: semanticColors.textTertiary,
		fontSize: "0.875rem",
	},
	centered: {
		padding: spacing["3xl"],
		textAlign: "center",
		color: semanticColors.textTertiary,
	},
});

export const Route = createFileRoute("/users/$userId")({
	beforeLoad: requireAdminAccess,
	component: UserDetailPage,
});

type Details = NonNullable<Awaited<ReturnType<typeof getUserDetails>>>;

const formatDate = (d: Date) =>
	new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function UserDetailPage() {
	const { userId } = Route.useParams();
	const admin = useAdminUser();
	const [details, setDetails] = useState<Details | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [dialog, setDialog] = useState<"ban" | "role" | null>(null);

	const load = useCallback(async () => {
		try {
			setDetails(await getUserDetails({ data: userId }));
			setError("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load user");
		} finally {
			setLoading(false);
		}
	}, [userId]);

	useEffect(() => {
		load();
	}, [load]);

	const backLink = (
		<Link to="/users" {...stylex.props(styles.backLink)}>
			<ArrowLeft size={16} />
			Back to Users
		</Link>
	);

	if (loading) {
		return (
			<main {...stylex.props(styles.container)}>
				{backLink}
				<p {...stylex.props(styles.centered)}>Loading user…</p>
			</main>
		);
	}

	if (error || !details) {
		return (
			<main {...stylex.props(styles.container)}>
				{backLink}
				<div {...stylex.props(styles.card, styles.centered)}>
					<AlertCircle size={32} />
					<h1 {...stylex.props(styles.cardTitle)}>
						{error ? "Couldn't load user" : "User not found"}
					</h1>
					<p {...stylex.props(styles.muted)}>
						{error || "This user may have been deleted or the link is wrong."}
					</p>
				</div>
			</main>
		);
	}

	const { user, recentPosts } = details;
	const isBanned = !!user.bannedAt;
	const { banBlockedReason, roleBlockedReason } = getPermissions(user, admin);
	const roleBadge =
		user.role === "admin"
			? styles.badgeAdmin
			: user.role === "moderator"
				? styles.badgeModerator
				: styles.badgeUser;

	const afterAction = () => {
		setDialog(null);
		load();
	};

	return (
		<main {...stylex.props(styles.container)}>
			{backLink}

			<div {...stylex.props(styles.header)}>
				<div {...stylex.props(styles.userSection)}>
					<div {...stylex.props(styles.avatar)}>
						{user.avatarUrl ? (
							<img
								src={user.avatarUrl}
								alt={user.displayName}
								{...stylex.props(styles.avatarImg)}
							/>
						) : (
							<User size={28} />
						)}
					</div>
					<div>
						<h1 {...stylex.props(styles.displayName)}>{user.displayName}</h1>
						<p {...stylex.props(styles.username)}>@{user.username}</p>
						<div {...stylex.props(styles.badges)}>
							<span {...stylex.props(styles.badge, roleBadge)}>{user.role}</span>
							<span
								{...stylex.props(styles.badge, isBanned ? styles.badgeBanned : styles.badgeActive)}
							>
								{isBanned ? "banned" : "active"}
							</span>
						</div>
					</div>
				</div>

				<div {...stylex.props(styles.actions)}>
					<button
						type="button"
						disabled={!!roleBlockedReason}
						title={roleBlockedReason ?? undefined}
						onClick={() => setDialog("role")}
						{...stylex.props(styles.actionButton, styles.roleButton)}
					>
						<Shield size={16} />
						Change Role
					</button>
					<button
						type="button"
						disabled={!!banBlockedReason}
						title={banBlockedReason ?? undefined}
						onClick={() => setDialog("ban")}
						{...stylex.props(styles.actionButton, isBanned ? styles.unbanButton : styles.banButton)}
					>
						{isBanned ? <ShieldCheck size={16} /> : <Ban size={16} />}
						{isBanned ? "Unban User" : "Ban User"}
					</button>
				</div>
			</div>

			{isBanned && (
				<output {...stylex.props(styles.banNotice)}>
					Banned on {formatDate(user.bannedAt as Date)}
					{user.bannedReason ? `: ${user.bannedReason}` : ""}
				</output>
			)}

			<div {...stylex.props(styles.grid)}>
				<div {...stylex.props(styles.sidebar)}>
					<section {...stylex.props(styles.card)}>
						<div {...stylex.props(styles.cardHeader)}>
							<h2 {...stylex.props(styles.cardTitle)}>User Information</h2>
						</div>
						<div {...stylex.props(styles.cardContent, styles.infoList)}>
							<div {...stylex.props(styles.infoItem)}>
								<Mail size={16} {...stylex.props(styles.infoIcon)} />
								<div>
									<div {...stylex.props(styles.infoLabel)}>Email</div>
									<div {...stylex.props(styles.infoValue)}>{user.email}</div>
								</div>
							</div>
							<div {...stylex.props(styles.infoItem)}>
								<Calendar size={16} {...stylex.props(styles.infoIcon)} />
								<div>
									<div {...stylex.props(styles.infoLabel)}>Joined</div>
									<div {...stylex.props(styles.infoValue)}>{formatDate(user.createdAt)}</div>
								</div>
							</div>
							<div {...stylex.props(styles.infoItem)}>
								<User size={16} {...stylex.props(styles.infoIcon)} />
								<div>
									<div {...stylex.props(styles.infoLabel)}>User ID</div>
									<div {...stylex.props(styles.infoValue)}>{user.id}</div>
								</div>
							</div>
							{user.bio && (
								<div {...stylex.props(styles.infoItem)}>
									<MessageSquare size={16} {...stylex.props(styles.infoIcon)} />
									<div>
										<div {...stylex.props(styles.infoLabel)}>Bio</div>
										<div {...stylex.props(styles.infoValue)}>{user.bio}</div>
									</div>
								</div>
							)}
						</div>
					</section>

					<section {...stylex.props(styles.card)}>
						<div {...stylex.props(styles.cardHeader)}>
							<h2 {...stylex.props(styles.cardTitle)}>Statistics</h2>
						</div>
						<div {...stylex.props(styles.cardContent, styles.statsGrid)}>
							<div>
								<div {...stylex.props(styles.statValue)}>{user.postCount}</div>
								<div {...stylex.props(styles.statLabel)}>Posts</div>
							</div>
							<div>
								<div {...stylex.props(styles.statValue)}>{user.commentCount}</div>
								<div {...stylex.props(styles.statLabel)}>Comments</div>
							</div>
						</div>
					</section>
				</div>

				<section {...stylex.props(styles.card)}>
					<div {...stylex.props(styles.cardHeader)}>
						<h2 {...stylex.props(styles.cardTitle)}>Recent Posts</h2>
					</div>
					<div {...stylex.props(styles.cardContent)}>
						{recentPosts.length === 0 ? (
							<p {...stylex.props(styles.muted)}>This user hasn't posted anything yet.</p>
						) : (
							recentPosts.map((post) => (
								<article key={post.id} {...stylex.props(styles.postItem)}>
									<p {...stylex.props(styles.postContent)}>{post.content}</p>
									<div {...stylex.props(styles.postMeta)}>
										<span {...stylex.props(styles.postMetaItem)}>
											<Heart size={12} /> {post.likeCount}
										</span>
										<span {...stylex.props(styles.postMetaItem)}>
											<MessageSquare size={12} /> {post.commentCount}
										</span>
										<span>{formatDate(post.createdAt)}</span>
									</div>
								</article>
							))
						)}
					</div>
				</section>
			</div>

			{dialog === "ban" && (
				<BanUserDialog user={user} onClose={() => setDialog(null)} onDone={afterAction} />
			)}
			{dialog === "role" && (
				<ChangeRoleDialog user={user} onClose={() => setDialog(null)} onDone={afterAction} />
			)}
		</main>
	);
}
