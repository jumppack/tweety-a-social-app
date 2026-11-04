import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	CheckCircle2,
	FileText,
	Flag,
	type LucideIcon,
	MessageSquare,
	TrendingUp,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getAuditActionIcon } from "../components/audit/auditIcons";
import { describeAuditDetails, formatRelativeTime, getAuditVerb } from "../lib/audit-format";
import { requireAdminAccess } from "../lib/auth-guard";
import {
	type ActivityItem,
	type DashboardStats,
	getDashboard,
} from "../server/functions/dashboard";
import { colors, radii, semanticColors, spacing } from "../tokens.stylex";

const styles = stylex.create({
	container: {
		maxWidth: "1400px",
		marginInline: "auto",
		paddingInline: spacing.lg,
		paddingBlock: spacing["2xl"],
	},
	header: {
		marginBottom: spacing["2xl"],
	},
	title: {
		fontSize: "1.5rem",
		fontWeight: 700,
		color: semanticColors.textPrimary,
		marginBottom: spacing.xs,
		letterSpacing: "-0.025em",
	},
	subtitle: {
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
	},
	statsGrid: {
		display: "grid",
		gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
		gap: spacing.lg,
		marginBottom: spacing["2xl"],
	},
	statCard: {
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.xl,
		padding: spacing.xl,
		border: `1px solid ${semanticColors.borderSubtle}`,
		transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
		backdropFilter: "blur(8px)",
		":hover": {
			borderColor: "rgba(99, 102, 241, 0.3)",
			boxShadow: "0 0 20px rgba(99, 102, 241, 0.08)",
			transform: "translateY(-2px)",
		},
	},
	statHeader: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: spacing.md,
	},
	statLabel: {
		color: semanticColors.textTertiary,
		fontSize: "0.8125rem",
		fontWeight: 500,
	},
	statIcon: {
		width: "2.25rem",
		height: "2.25rem",
		borderRadius: radii.lg,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	statIconBlue: {
		backgroundColor: semanticColors.primaryLight,
		color: colors.blue400,
	},
	statIconGreen: {
		backgroundColor: "rgba(34, 197, 94, 0.12)",
		color: colors.green400,
	},
	statIconPurple: {
		backgroundColor: "rgba(168, 85, 247, 0.12)",
		color: "#c084fc",
	},
	statIconOrange: {
		backgroundColor: "rgba(249, 115, 22, 0.12)",
		color: "#fb923c",
	},
	statValue: {
		fontSize: "1.75rem",
		fontWeight: 700,
		color: semanticColors.textPrimary,
		marginBottom: spacing.xs,
		letterSpacing: "-0.025em",
	},
	statChange: {
		fontSize: "0.75rem",
		display: "flex",
		alignItems: "center",
		gap: "4px",
	},
	statChangePositive: {
		color: colors.green400,
	},
	statChangeNegative: {
		color: colors.red400,
	},
	section: {
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.xl,
		border: `1px solid ${semanticColors.borderSubtle}`,
		marginBottom: spacing.lg,
		backdropFilter: "blur(8px)",
	},
	sectionHeader: {
		padding: spacing.lg,
		borderBottom: `1px solid ${semanticColors.borderSubtle}`,
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
	},
	sectionTitle: {
		fontSize: "1rem",
		fontWeight: 600,
		color: semanticColors.textPrimary,
		letterSpacing: "-0.015em",
	},
	sectionContent: {
		padding: spacing.lg,
	},
	activityList: {
		listStyle: "none",
		margin: 0,
		padding: 0,
		display: "flex",
		flexDirection: "column",
		gap: spacing.md,
	},
	activityItem: {
		display: "flex",
		alignItems: "flex-start",
		gap: spacing.md,
		paddingBottom: spacing.md,
		borderBottom: `1px solid ${semanticColors.borderSubtle}`,
	},
	activityItemLast: {
		borderBottom: "none",
		paddingBottom: 0,
	},
	activityIcon: {
		width: "2rem",
		height: "2rem",
		borderRadius: radii.lg,
		backgroundColor: semanticColors.primaryLight,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		color: colors.indigo400,
		flexShrink: 0,
	},
	activityContent: {
		flex: 1,
	},
	activityText: {
		color: semanticColors.textSecondary,
		fontSize: "0.8125rem",
		marginBottom: "4px",
	},
	activityTime: {
		color: semanticColors.textTertiary,
		fontSize: "0.6875rem",
	},
	emptyState: {
		textAlign: "center",
		color: semanticColors.textTertiary,
		paddingBlock: spacing.xl,
		fontSize: "0.875rem",
	},
	statChangeNeutral: {
		color: semanticColors.textTertiary,
	},
	statChangeWarning: {
		color: "#fb923c",
	},
	statLink: {
		display: "block",
		color: "inherit",
		textDecoration: "none",
		borderRadius: radii.xl,
		":focus-visible": {
			outline: `2px solid ${semanticColors.borderFocus}`,
			outlineOffset: "2px",
		},
	},
	viewAllLink: {
		color: semanticColors.primary,
		fontSize: "0.8125rem",
		fontWeight: 500,
		textDecoration: "none",
		":hover": {
			textDecoration: "underline",
		},
	},
	inlineLink: {
		color: semanticColors.textPrimary,
		fontWeight: 500,
		textDecoration: "none",
		":hover": {
			textDecoration: "underline",
		},
	},
	activityDetail: {
		color: semanticColors.textTertiary,
	},
	errorState: {
		textAlign: "center",
		color: semanticColors.error,
		paddingBlock: spacing.xl,
		fontSize: "0.875rem",
	},
});

export const Route = createFileRoute("/")({
	beforeLoad: requireAdminAccess,
	component: DashboardPage,
});

type Tone = "positive" | "negative" | "warning" | "neutral";
type StatColor = "blue" | "green" | "purple" | "orange";

interface StatCardData {
	label: string;
	value: string;
	change: string;
	tone: Tone;
	icon: LucideIcon;
	changeIcon: LucideIcon;
	color: StatColor;
}

const iconStyles = {
	blue: styles.statIconBlue,
	green: styles.statIconGreen,
	purple: styles.statIconPurple,
	orange: styles.statIconOrange,
};

const toneStyles = {
	positive: styles.statChangePositive,
	negative: styles.statChangeNegative,
	warning: styles.statChangeWarning,
	neutral: styles.statChangeNeutral,
};

const formatCount = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? "" : "s"}`;

function buildStats(stats: DashboardStats | null): StatCardData[] {
	const value = (n: number | undefined) => (n === undefined ? "…" : formatCount(n));
	const todayChange = (n: number | undefined, noun: string) =>
		n === undefined ? "Loading…" : n > 0 ? `+${formatCount(n)} today` : `No new ${noun} today`;
	const todayTone = (n: number | undefined): Tone => (n ? "positive" : "neutral");

	const comments = stats?.totalComments;
	const posts = stats?.totalPosts;
	const pending = stats?.pendingReports;

	return [
		{
			label: "Total Users",
			value: value(stats?.totalUsers),
			change:
				stats === null
					? "Loading…"
					: `${todayChange(stats.newUsersToday, "users")} · ${plural(stats.bannedUsers, "banned user")}`,
			tone: todayTone(stats?.newUsersToday),
			icon: Users,
			changeIcon: TrendingUp,
			color: "blue",
		},
		{
			label: "Total Posts",
			value: value(posts),
			change: todayChange(stats?.newPostsToday, "posts"),
			tone: todayTone(stats?.newPostsToday),
			icon: FileText,
			changeIcon: TrendingUp,
			color: "green",
		},
		{
			label: "Comments",
			value: value(comments),
			change:
				comments === undefined || posts === undefined
					? "Loading…"
					: posts > 0
						? `${(comments / posts).toFixed(1)} per post on average`
						: "No posts yet",
			tone: "neutral",
			icon: MessageSquare,
			changeIcon: MessageSquare,
			color: "purple",
		},
		{
			label: "Pending Reports",
			value: value(pending),
			change:
				pending === undefined
					? "Loading…"
					: pending === 0
						? "All clear"
						: `${formatCount(pending)} need review`,
			tone: pending === undefined ? "neutral" : pending === 0 ? "positive" : "warning",
			icon: Flag,
			changeIcon: pending ? AlertTriangle : CheckCircle2,
			color: "orange",
		},
	];
}

function StatCard({ stat }: { stat: StatCardData }) {
	const Icon = stat.icon;
	const ChangeIcon = stat.changeIcon;
	return (
		<div data-testid="stat-card" {...stylex.props(styles.statCard)}>
			<div {...stylex.props(styles.statHeader)}>
				<span {...stylex.props(styles.statLabel)}>{stat.label}</span>
				<div {...stylex.props(styles.statIcon, iconStyles[stat.color])}>
					<Icon size={20} />
				</div>
			</div>
			<div data-testid="stat-value" {...stylex.props(styles.statValue)}>
				{stat.value}
			</div>
			<div data-testid="stat-change" {...stylex.props(styles.statChange, toneStyles[stat.tone])}>
				<ChangeIcon size={12} />
				{stat.change}
			</div>
		</div>
	);
}

function UserLink({ userId, username }: { userId: string; username: string }) {
	return (
		<Link to="/users/$userId" params={{ userId }} {...stylex.props(styles.inlineLink)}>
			@{username}
		</Link>
	);
}

function activityIcon(item: ActivityItem): LucideIcon {
	switch (item.kind) {
		case "audit":
			return getAuditActionIcon(item.entry.action);
		case "user":
			return Users;
		case "post":
			return FileText;
	}
}

function ActivityText({ item }: { item: ActivityItem }) {
	switch (item.kind) {
		case "user":
			return (
				<>
					New user <UserLink userId={item.userId} username={item.username} /> joined the platform
				</>
			);
		case "post":
			return (
				<>
					<UserLink userId={item.authorId} username={item.authorUsername} /> posted “{item.excerpt}”
				</>
			);
		case "audit": {
			const { entry } = item;
			const detail = describeAuditDetails(entry.action, entry.details);
			const target = entry.targetLabel ?? "an item";
			return (
				<>
					<UserLink userId={entry.adminId} username={entry.adminUsername} />{" "}
					{getAuditVerb(entry.action, entry.details)}{" "}
					{entry.targetLink?.kind === "user" ? (
						<Link
							to="/users/$userId"
							params={{ userId: entry.targetLink.id }}
							{...stylex.props(styles.inlineLink)}
						>
							{target}
						</Link>
					) : (
						target
					)}
					{detail && <span {...stylex.props(styles.activityDetail)}> · {detail}</span>}
				</>
			);
		}
	}
}

function DashboardPage() {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [activity, setActivity] = useState<ActivityItem[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;
		getDashboard()
			.then((result) => {
				if (cancelled) return;
				setStats(result.stats);
				setActivity(result.activity);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard");
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const statCards = buildStats(stats);
	const pendingReports = stats?.pendingReports;

	return (
		<main {...stylex.props(styles.container)}>
			<header {...stylex.props(styles.header)}>
				<h1 {...stylex.props(styles.title)}>Dashboard</h1>
				<p {...stylex.props(styles.subtitle)}>Overview of Tweety platform activity</p>
			</header>

			{error && (
				<p role="alert" {...stylex.props(styles.errorState)}>
					{error}
				</p>
			)}

			<div {...stylex.props(styles.statsGrid)}>
				{statCards.map((stat) =>
					stat.label === "Pending Reports" ? (
						// The accessible name avoids "reports" so it doesn't shadow the nav link
						<Link
							key={stat.label}
							to="/reports"
							aria-label={`Open moderation queue${pendingReports === undefined ? "" : ` (${formatCount(pendingReports)} pending)`}`}
							{...stylex.props(styles.statLink)}
						>
							<StatCard stat={stat} />
						</Link>
					) : (
						<StatCard key={stat.label} stat={stat} />
					),
				)}
			</div>

			<section {...stylex.props(styles.section)} aria-labelledby="recent-activity-title">
				<div {...stylex.props(styles.sectionHeader)}>
					<h2 id="recent-activity-title" {...stylex.props(styles.sectionTitle)}>
						Recent Activity
					</h2>
					<Link to="/audit" {...stylex.props(styles.viewAllLink)}>
						Full audit log →
					</Link>
				</div>
				<div {...stylex.props(styles.sectionContent)}>
					{activity === null ? (
						<p {...stylex.props(styles.emptyState)}>
							{error ? "Activity unavailable" : "Loading activity…"}
						</p>
					) : activity.length === 0 ? (
						<p {...stylex.props(styles.emptyState)}>No activity yet</p>
					) : (
						<ul {...stylex.props(styles.activityList)} data-testid="activity-list">
							{activity.map((item, index) => {
								const Icon = activityIcon(item);
								const isLast = index === activity.length - 1;
								return (
									<li
										key={item.id}
										data-testid="activity-item"
										data-kind={item.kind}
										{...stylex.props(styles.activityItem, isLast && styles.activityItemLast)}
									>
										<div {...stylex.props(styles.activityIcon)}>
											<Icon size={14} />
										</div>
										<div {...stylex.props(styles.activityContent)}>
											<p {...stylex.props(styles.activityText)}>
												<ActivityText item={item} />
											</p>
											<time
												dateTime={new Date(item.createdAt).toISOString()}
												title={new Date(item.createdAt).toLocaleString()}
												{...stylex.props(styles.activityTime)}
											>
												{formatRelativeTime(item.createdAt)}
											</time>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			</section>
		</main>
	);
}
