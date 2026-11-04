import * as stylex from "@stylexjs/stylex";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReportCard } from "../../components/reports/ReportCard";
import { ReviewReportDialog } from "../../components/reports/ReviewReportDialog";
import { requireAdminAccess } from "../../lib/auth-guard";
import {
	type AdminReport,
	listReports,
	type ReportCounts,
	type ReportStatusFilter,
	type ReportTargetType,
	type ReviewAction,
} from "../../server/functions/reports";
import { radii, semanticColors, spacing } from "../../tokens.stylex";
import { useAdminUser } from "../__root";

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
		flexWrap: "wrap",
		gap: spacing.md,
		marginBottom: spacing.xl,
	},
	title: {
		fontSize: "1.875rem",
		fontWeight: 700,
		color: semanticColors.textPrimary,
	},
	controls: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: spacing.md,
	},
	tabs: {
		display: "flex",
		flexWrap: "wrap",
		gap: spacing.sm,
	},
	tab: {
		paddingInline: spacing.md,
		paddingBlock: spacing.sm,
		borderRadius: radii.md,
		border: "none",
		backgroundColor: "transparent",
		color: semanticColors.textTertiary,
		fontSize: "0.875rem",
		fontWeight: 500,
		cursor: "pointer",
		":hover": {
			backgroundColor: semanticColors.bgSecondary,
			color: semanticColors.textPrimary,
		},
	},
	tabActive: {
		backgroundColor: semanticColors.bgSecondary,
		color: semanticColors.textPrimary,
	},
	select: {
		paddingBlock: spacing.sm,
		paddingInline: spacing.md,
		borderRadius: radii.md,
		border: `1px solid ${semanticColors.borderDefault}`,
		backgroundColor: semanticColors.surfaceInput,
		color: semanticColors.textPrimary,
		fontSize: "0.875rem",
		":focus": {
			outline: "none",
			borderColor: semanticColors.borderFocus,
		},
	},
	notice: {
		marginBottom: spacing.md,
		padding: spacing.sm,
		paddingInline: spacing.md,
		borderRadius: radii.md,
		backgroundColor: semanticColors.bgSecondary,
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
	},
	error: {
		backgroundColor: semanticColors.errorBg,
		color: semanticColors.error,
	},
	live: {
		display: "block",
	},
	reportsList: {
		display: "flex",
		flexDirection: "column",
		gap: spacing.md,
	},
	emptyState: {
		padding: spacing.xl,
		textAlign: "center",
		color: semanticColors.textTertiary,
		fontSize: "0.875rem",
	},
	loadMore: {
		alignSelf: "center",
		paddingInline: spacing.lg,
		paddingBlock: spacing.sm,
		borderRadius: radii.md,
		border: `1px solid ${semanticColors.borderDefault}`,
		backgroundColor: "transparent",
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

const STATUSES: ReportStatusFilter[] = ["pending", "actioned", "dismissed", "all"];
const TYPES: ReportTargetType[] = ["post", "comment", "user"];
const PAGE_SIZE = 25;

interface ReportsSearch {
	status?: ReportStatusFilter;
	type?: ReportTargetType;
}

export const Route = createFileRoute("/reports/")({
	beforeLoad: requireAdminAccess,
	// Tab and filter live in the URL so a reload (or a shared link) keeps them
	validateSearch: (search: Record<string, unknown>): ReportsSearch => ({
		status: STATUSES.includes(search.status as ReportStatusFilter)
			? (search.status as ReportStatusFilter)
			: undefined,
		type: TYPES.includes(search.type as ReportTargetType)
			? (search.type as ReportTargetType)
			: undefined,
	}),
	component: ReportsPage,
});

const TAB_LABEL: Record<ReportStatusFilter, string> = {
	pending: "Pending",
	actioned: "Resolved",
	dismissed: "Dismissed",
	all: "All",
};

const TYPE_LABEL: Record<ReportTargetType, string> = {
	post: "posts",
	comment: "comments",
	user: "users",
};

const DONE_MESSAGE: Record<ReviewAction, string> = {
	dismiss: "Report dismissed.",
	remove_content: "Content removed and report resolved.",
	ban_user: "User banned and report resolved.",
};

type DialogState = { report: AdminReport; action: ReviewAction } | null;

function ReportsPage() {
	const admin = useAdminUser();
	const navigate = useNavigate({ from: Route.fullPath });
	const search = Route.useSearch();
	const status = search.status ?? "pending";
	const type = search.type;

	const [reports, setReports] = useState<AdminReport[]>([]);
	const [total, setTotal] = useState(0);
	const [counts, setCounts] = useState<ReportCounts | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [dialog, setDialog] = useState<DialogState>(null);
	const latestRequest = useRef(0);

	const load = useCallback(
		async (limit = PAGE_SIZE) => {
			const requestId = ++latestRequest.current;
			try {
				const result = await listReports({ data: { status, type, limit, offset: 0 } });
				if (requestId !== latestRequest.current) return; // a newer tab/filter is loading
				setReports(result.reports);
				setTotal(result.total);
				setCounts(result.counts);
				setError("");
			} catch (err) {
				if (requestId === latestRequest.current) {
					setError(err instanceof Error ? err.message : "Failed to load reports");
				}
			} finally {
				if (requestId === latestRequest.current) setLoading(false);
			}
		},
		[status, type],
	);

	useEffect(() => {
		setLoading(true);
		load();
	}, [load]);

	const loadMore = async () => {
		const requestId = latestRequest.current;
		setLoadingMore(true);
		try {
			const result = await listReports({
				data: { status, type, limit: PAGE_SIZE, offset: reports.length },
			});
			if (requestId !== latestRequest.current) return;
			setReports((prev) => {
				const seen = new Set(prev.map((r) => r.id));
				return [...prev, ...result.reports.filter((r) => !seen.has(r.id))];
			});
			setTotal(result.total);
			setCounts(result.counts);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load reports");
		} finally {
			setLoadingMore(false);
		}
	};

	const setSearch = (next: ReportsSearch) => {
		setNotice("");
		navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
	};

	const afterAction = (action: ReviewAction) => {
		setDialog(null);
		setNotice(DONE_MESSAGE[action]);
		load(Math.max(PAGE_SIZE, reports.length));
	};

	const emptyMessage =
		status === "all"
			? `No ${type ? `${TYPE_LABEL[type]} ` : ""}reports`
			: `No ${TAB_LABEL[status].toLowerCase()} ${type ? `${TYPE_LABEL[type].slice(0, -1)} ` : ""}reports`;

	return (
		<main {...stylex.props(styles.container)}>
			<header {...stylex.props(styles.header)}>
				<h1 {...stylex.props(styles.title)}>Reports</h1>
				<div {...stylex.props(styles.controls)}>
					<div role="tablist" aria-label="Report status" {...stylex.props(styles.tabs)}>
						{STATUSES.map((tab) => {
							const active = tab === status;
							return (
								<button
									key={tab}
									type="button"
									role="tab"
									aria-selected={active}
									data-state={active ? "active" : "inactive"}
									onClick={() => setSearch({ status: tab === "pending" ? undefined : tab })}
									{...stylex.props(styles.tab, active && styles.tabActive)}
								>
									{TAB_LABEL[tab]}
									{counts ? ` (${counts[tab]})` : ""}
								</button>
							);
						})}
					</div>
					<select
						aria-label="Filter by type"
						value={type ?? ""}
						onChange={(e) =>
							setSearch({ type: (e.target.value || undefined) as ReportTargetType | undefined })
						}
						{...stylex.props(styles.select)}
					>
						<option value="">All types</option>
						<option value="post">Posts</option>
						<option value="comment">Comments</option>
						<option value="user">Users</option>
					</select>
				</div>
			</header>

			<output aria-live="polite" {...stylex.props(styles.live)}>
				{notice && <p {...stylex.props(styles.notice)}>{notice}</p>}
			</output>
			{error && !loading && (
				<p role="alert" {...stylex.props(styles.notice, styles.error)}>
					{error}
				</p>
			)}

			<div role="tabpanel" aria-busy={loading} {...stylex.props(styles.reportsList)}>
				{loading ? (
					<div {...stylex.props(styles.emptyState)}>Loading reports…</div>
				) : reports.length === 0 ? (
					!error && <div {...stylex.props(styles.emptyState)}>{emptyMessage}</div>
				) : (
					<>
						{reports.map((report) => (
							<ReportCard
								key={report.id}
								report={report}
								actorId={admin?.id ?? null}
								onAction={(action) => setDialog({ report, action })}
							/>
						))}
						{reports.length < total && (
							<button
								type="button"
								onClick={loadMore}
								disabled={loadingMore}
								{...stylex.props(styles.loadMore)}
							>
								{loadingMore ? "Loading…" : `Load more (${total - reports.length} left)`}
							</button>
						)}
					</>
				)}
			</div>

			{dialog && (
				<ReviewReportDialog
					report={dialog.report}
					action={dialog.action}
					onClose={() => setDialog(null)}
					onDone={afterAction}
				/>
			)}
		</main>
	);
}
