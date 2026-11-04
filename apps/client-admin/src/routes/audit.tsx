import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Filter, Globe, Search, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type AuditTone,
	getAuditActionIcon,
	getAuditActionTone,
	getAuditTargetIcon,
} from "../components/audit/auditIcons";
import {
	AUDIT_ACTION_FILTER_LABELS,
	AUDIT_ACTIONS,
	describeAuditDetails,
	formatRelativeTime,
	getAuditActionLabel,
	groupByDate,
	type KnownAuditAction,
} from "../lib/audit-format";
import { requireAdminAccess } from "../lib/auth-guard";
import { type AuditEntry, listAuditLogs } from "../server/functions/audit";
import { colors, radii, semanticColors, spacing } from "../tokens.stylex";

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
	filterButton: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		paddingInline: spacing.md,
		paddingBlock: spacing.sm,
		borderRadius: radii.md,
		border: `1px solid ${semanticColors.borderDefault}`,
		backgroundColor: semanticColors.surfaceInput,
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
		cursor: "pointer",
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
	},
	timeline: {
		position: "relative",
		paddingLeft: "32px",
	},
	timelineLine: {
		position: "absolute",
		left: "11px",
		top: 0,
		bottom: 0,
		width: "2px",
		backgroundColor: semanticColors.borderSubtle,
	},
	logEntry: {
		position: "relative",
		marginBottom: spacing.lg,
	},
	logEntryLast: {
		marginBottom: 0,
	},
	logIcon: {
		position: "absolute",
		left: "-32px",
		width: "24px",
		height: "24px",
		borderRadius: "50%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: semanticColors.surfaceCard,
		border: `2px solid ${semanticColors.borderSubtle}`,
	},
	logIconDanger: {
		backgroundColor: semanticColors.errorLight,
		borderColor: "rgba(239, 68, 68, 0.45)",
		color: semanticColors.error,
	},
	logIconRole: {
		backgroundColor: "rgba(168, 85, 247, 0.12)",
		borderColor: "rgba(168, 85, 247, 0.45)",
		color: "#a855f7",
	},
	logIconResolve: {
		backgroundColor: "rgba(34, 197, 94, 0.12)",
		borderColor: "rgba(34, 197, 94, 0.45)",
		color: semanticColors.success,
	},
	logIconDefault: {
		backgroundColor: semanticColors.surfaceCard,
		borderColor: semanticColors.borderDefault,
		color: semanticColors.textTertiary,
	},
	logCard: {
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.lg,
		border: `1px solid ${semanticColors.borderSubtle}`,
		padding: spacing.md,
	},
	logHeader: {
		display: "flex",
		alignItems: "flex-start",
		justifyContent: "space-between",
		marginBottom: spacing.sm,
	},
	logAction: {
		color: semanticColors.textPrimary,
		fontWeight: 500,
		fontSize: "0.9375rem",
	},
	logTime: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
	},
	logDescription: {
		color: semanticColors.textTertiary,
		fontSize: "0.875rem",
		marginBottom: spacing.md,
	},
	logMeta: {
		display: "flex",
		alignItems: "center",
		gap: spacing.lg,
		paddingTop: spacing.sm,
		borderTop: `1px solid ${semanticColors.borderSubtle}`,
	},
	logMetaItem: {
		display: "flex",
		alignItems: "center",
		gap: spacing.xs,
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
	},
	adminLink: {
		color: colors.blue400,
		textDecoration: "none",
		":hover": {
			textDecoration: "underline",
		},
	},
	targetLink: {
		color: semanticColors.textSecondary,
		textDecoration: "none",
		":hover": {
			textDecoration: "underline",
		},
	},
	dateHeader: {
		color: semanticColors.textTertiary,
		fontSize: "0.875rem",
		fontWeight: 600,
		marginBottom: spacing.md,
		marginTop: spacing.xl,
	},
	dateHeaderFirst: {
		marginTop: 0,
	},
	filterSelect: {
		appearance: "none",
		border: "none",
		backgroundColor: "transparent",
		color: "inherit",
		fontSize: "inherit",
		cursor: "pointer",
		paddingRight: spacing.xs,
		":focus": {
			outline: "none",
		},
	},
	filterActive: {
		borderColor: semanticColors.borderFocus,
		color: semanticColors.textPrimary,
	},
	message: {
		textAlign: "center",
		color: semanticColors.textTertiary,
		paddingBlock: spacing["2xl"],
		fontSize: "0.875rem",
	},
	errorMessage: {
		color: semanticColors.error,
	},
	loadMoreRow: {
		display: "flex",
		justifyContent: "center",
		marginTop: spacing.xl,
	},
	loadMoreButton: {
		paddingInline: spacing.lg,
		paddingBlock: spacing.sm,
		borderRadius: radii.md,
		border: `1px solid ${semanticColors.borderDefault}`,
		backgroundColor: semanticColors.surfaceInput,
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
		cursor: "pointer",
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
		":disabled": {
			cursor: "default",
			opacity: 0.6,
		},
	},
	timelineList: {
		listStyle: "none",
		margin: 0,
		padding: 0,
	},
	plainTarget: {
		color: semanticColors.textSecondary,
	},
});

export const Route = createFileRoute("/audit")({
	beforeLoad: requireAdminAccess,
	component: AuditPage,
});

const toneStyles = {
	danger: styles.logIconDanger,
	role: styles.logIconRole,
	resolve: styles.logIconResolve,
	neutral: styles.logIconDefault,
} satisfies Record<AuditTone, unknown>;

function matchesSearch(entry: AuditEntry, query: string): boolean {
	const haystack = [
		entry.adminUsername,
		getAuditActionLabel(entry.action, entry.details),
		describeAuditDetails(entry.action, entry.details),
		entry.targetLabel,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	return haystack.includes(query.toLowerCase());
}

function TargetMeta({ entry }: { entry: AuditEntry }) {
	if (!entry.targetLabel) return null;
	const TargetIcon = getAuditTargetIcon(entry.targetType);
	const link = entry.targetLink;
	return (
		<span {...stylex.props(styles.logMetaItem)}>
			<TargetIcon size={12} />
			Target:{" "}
			{link?.kind === "user" ? (
				<Link
					to="/users/$userId"
					params={{ userId: link.id }}
					data-testid="resource-link"
					{...stylex.props(styles.targetLink)}
				>
					{entry.targetLabel}
				</Link>
			) : link?.kind === "post" ? (
				<Link
					to="/posts/$postId"
					params={{ postId: link.id }}
					data-testid="resource-link"
					{...stylex.props(styles.targetLink)}
				>
					{entry.targetLabel}
				</Link>
			) : (
				<span {...stylex.props(styles.plainTarget)}>{entry.targetLabel}</span>
			)}
		</span>
	);
}

function AuditLogEntry({ entry, isLast }: { entry: AuditEntry; isLast: boolean }) {
	const ActionIcon = getAuditActionIcon(entry.action);
	const description = describeAuditDetails(entry.action, entry.details);
	const createdAt = new Date(entry.createdAt);
	return (
		<li
			data-testid="audit-entry"
			data-id={entry.id}
			data-action={entry.action}
			{...stylex.props(styles.logEntry, isLast && styles.logEntryLast)}
		>
			<div {...stylex.props(styles.logIcon, toneStyles[getAuditActionTone(entry.action)])}>
				<ActionIcon size={12} />
			</div>
			<div {...stylex.props(styles.logCard)}>
				<div {...stylex.props(styles.logHeader)}>
					<span data-testid="audit-action" {...stylex.props(styles.logAction)}>
						{getAuditActionLabel(entry.action, entry.details)}
					</span>
					<time
						dateTime={createdAt.toISOString()}
						title={createdAt.toLocaleString()}
						{...stylex.props(styles.logTime)}
					>
						<Calendar size={12} />
						{formatRelativeTime(createdAt)}
					</time>
				</div>
				{description && (
					<p data-testid="action-details" {...stylex.props(styles.logDescription)}>
						{description}
					</p>
				)}
				<div {...stylex.props(styles.logMeta)}>
					<span {...stylex.props(styles.logMetaItem)}>
						<Shield size={12} />
						By{" "}
						<Link
							to="/users/$userId"
							params={{ userId: entry.adminId }}
							{...stylex.props(styles.adminLink)}
						>
							@{entry.adminUsername}
						</Link>
					</span>
					<TargetMeta entry={entry} />
					{entry.ipAddress && (
						<span {...stylex.props(styles.logMetaItem)}>
							<Globe size={12} />
							{entry.ipAddress}
						</span>
					)}
				</div>
			</div>
		</li>
	);
}

function AuditPage() {
	const [entries, setEntries] = useState<AuditEntry[]>([]);
	const [hasMore, setHasMore] = useState(false);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState("");
	const [action, setAction] = useState<KnownAuditAction | "">("");
	const [search, setSearch] = useState("");
	const latestRequest = useRef(0);

	const load = useCallback(async (filter: string, offset: number) => {
		const requestId = ++latestRequest.current;
		if (offset === 0) setLoading(true);
		else setLoadingMore(true);
		try {
			const result = await listAuditLogs({ data: { action: filter || undefined, offset } });
			if (requestId !== latestRequest.current) return; // filter changed meanwhile
			setEntries((prev) => {
				if (offset === 0) return result.entries;
				// New actions logged since page one shift offsets; drop the repeats
				const seen = new Set(prev.map((entry) => entry.id));
				return [...prev, ...result.entries.filter((entry) => !seen.has(entry.id))];
			});
			setHasMore(result.hasMore && result.entries.length > 0);
			setError("");
		} catch (err) {
			if (requestId === latestRequest.current) {
				setError(err instanceof Error ? err.message : "Failed to load audit log");
			}
		} finally {
			if (requestId === latestRequest.current) {
				setLoading(false);
				setLoadingMore(false);
			}
		}
	}, []);

	useEffect(() => {
		load(action, 0);
	}, [action, load]);

	const query = search.trim();
	const visible = useMemo(
		() => (query ? entries.filter((entry) => matchesSearch(entry, query)) : entries),
		[entries, query],
	);
	const groups = useMemo(() => groupByDate(visible), [visible]);

	let message: string | null = null;
	if (loading) message = "Loading audit log…";
	else if (error && entries.length === 0) message = error;
	else if (entries.length === 0)
		message = action
			? `No "${AUDIT_ACTION_FILTER_LABELS[action].toLowerCase()}" entries yet`
			: "No admin actions have been logged yet";
	else if (visible.length === 0) message = `No loaded entries match "${query}"`;

	return (
		<main {...stylex.props(styles.container)}>
			<header {...stylex.props(styles.header)}>
				<h1 {...stylex.props(styles.title)}>Audit Log</h1>
				<div {...stylex.props(styles.filters)}>
					<label {...stylex.props(styles.filterButton, action !== "" && styles.filterActive)}>
						<Filter size={16} />
						<select
							name="action"
							data-testid="action-filter"
							aria-label="Filter by action"
							value={action}
							onChange={(e) => setAction(e.target.value as KnownAuditAction | "")}
							{...stylex.props(styles.filterSelect)}
						>
							<option value="">All actions</option>
							{AUDIT_ACTIONS.map((value) => (
								<option key={value} value={value}>
									{AUDIT_ACTION_FILTER_LABELS[value]}
								</option>
							))}
						</select>
					</label>
					<div {...stylex.props(styles.searchContainer)}>
						<Search size={16} {...stylex.props(styles.searchIcon)} />
						<input
							type="search"
							placeholder="Search logs..."
							aria-label="Search loaded audit log entries"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							{...stylex.props(styles.searchInput)}
						/>
					</div>
				</div>
			</header>

			{message ? (
				<p
					data-testid="audit-message"
					role={error && entries.length === 0 && !loading ? "alert" : undefined}
					{...stylex.props(
						styles.message,
						!!error && entries.length === 0 && !loading && styles.errorMessage,
					)}
				>
					{message}
				</p>
			) : (
				groups.map((group, groupIndex) => (
					<section key={group.label} aria-label={group.label}>
						<h2 {...stylex.props(styles.dateHeader, groupIndex === 0 && styles.dateHeaderFirst)}>
							{group.label}
						</h2>
						<div {...stylex.props(styles.timeline)}>
							<div {...stylex.props(styles.timelineLine)} />
							<ol {...stylex.props(styles.timelineList)}>
								{group.items.map((entry, index) => (
									<AuditLogEntry
										key={entry.id}
										entry={entry}
										isLast={index === group.items.length - 1}
									/>
								))}
							</ol>
						</div>
					</section>
				))
			)}

			{!loading && hasMore && (
				<div {...stylex.props(styles.loadMoreRow)}>
					<button
						type="button"
						data-testid="load-more"
						disabled={loadingMore}
						onClick={() => load(action, entries.length)}
						{...stylex.props(styles.loadMoreButton)}
					>
						{loadingMore ? "Loading…" : "Load more"}
					</button>
				</div>
			)}
			{error && entries.length > 0 && (
				<p role="alert" {...stylex.props(styles.message, styles.errorMessage)}>
					{error}
				</p>
			)}
		</main>
	);
}
