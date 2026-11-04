import * as stylex from "@stylexjs/stylex";
import { CheckCircle2, Flag, X } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type ReportTargetType, reportContent } from "../../server/functions/reports";
import { colors, radii, semanticColors, shadows, spacing, zIndex } from "../../tokens.stylex";

export const REPORT_REASONS = [
	"Spam",
	"Harassment or bullying",
	"Hate speech",
	"Misinformation",
	"Violence or threats",
	"Other",
] as const;

const DETAILS_MAX = 500;

const fadeIn = stylex.keyframes({
	from: { opacity: 0 },
	to: { opacity: 1 },
});

const popIn = stylex.keyframes({
	from: { opacity: 0, transform: "translateY(8px) scale(0.98)" },
	to: { opacity: 1, transform: "translateY(0) scale(1)" },
});

const styles = stylex.create({
	backdrop: {
		position: "fixed",
		inset: 0,
		zIndex: zIndex.modal,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.lg,
		backgroundColor: "rgba(15, 23, 42, 0.45)",
		animationName: fadeIn,
		animationDuration: "0.15s",
	},
	dialog: {
		width: "100%",
		maxWidth: "28rem",
		maxHeight: "calc(100vh - 2rem)",
		overflowY: "auto",
		backgroundColor: semanticColors.bgPrimary,
		color: semanticColors.textPrimary,
		borderRadius: radii["2xl"],
		boxShadow: shadows["2xl"],
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: semanticColors.borderDefault,
		padding: spacing["2xl"],
		animationName: popIn,
		animationDuration: "0.2s",
	},
	header: {
		display: "flex",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: spacing.md,
		marginBottom: spacing.lg,
	},
	title: {
		fontSize: "1.125rem",
		fontWeight: 700,
		color: semanticColors.textPrimary,
		margin: 0,
	},
	subtitle: {
		marginTop: spacing.xs,
		fontSize: "0.875rem",
		color: semanticColors.textSecondary,
	},
	closeButton: {
		display: "flex",
		padding: spacing.xs,
		borderRadius: radii.full,
		backgroundColor: "transparent",
		border: "none",
		cursor: "pointer",
		color: semanticColors.textTertiary,
		":hover": {
			color: semanticColors.textPrimary,
			backgroundColor: semanticColors.bgHover,
		},
	},
	fieldset: {
		borderWidth: 0,
		borderStyle: "none",
		minWidth: 0,
		margin: 0,
		padding: 0,
	},
	legend: {
		fontSize: "0.875rem",
		fontWeight: 600,
		color: semanticColors.textPrimary,
		marginBottom: spacing.sm,
		padding: 0,
	},
	reasons: {
		display: "flex",
		flexDirection: "column",
		gap: spacing.xs,
	},
	reasonOption: {
		display: "flex",
		alignItems: "center",
		gap: spacing.sm,
		paddingTop: spacing.sm,
		paddingBottom: spacing.sm,
		paddingLeft: spacing.md,
		paddingRight: spacing.md,
		borderRadius: radii.lg,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: semanticColors.borderDefault,
		fontSize: "0.875rem",
		color: semanticColors.textPrimary,
		cursor: "pointer",
		transition: "background-color 0.15s, border-color 0.15s",
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
	},
	reasonOptionSelected: {
		borderColor: semanticColors.borderFocus,
		backgroundColor: semanticColors.primaryLight,
	},
	radio: {
		accentColor: semanticColors.primary,
		margin: 0,
	},
	detailsLabel: {
		display: "block",
		marginTop: spacing.lg,
		marginBottom: spacing.sm,
		fontSize: "0.875rem",
		fontWeight: 600,
		color: semanticColors.textPrimary,
	},
	optional: {
		fontWeight: 400,
		color: semanticColors.textTertiary,
	},
	textarea: {
		width: "100%",
		minHeight: "5rem",
		padding: spacing.sm,
		fontSize: "0.875rem",
		fontFamily: "inherit",
		color: semanticColors.textPrimary,
		backgroundColor: semanticColors.surfaceInput,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: semanticColors.borderDefault,
		borderRadius: radii.lg,
		resize: "vertical",
		boxSizing: "border-box",
		":focus": {
			outline: "none",
			borderColor: semanticColors.borderFocus,
		},
	},
	counter: {
		marginTop: spacing.xs,
		textAlign: "right",
		fontSize: "0.75rem",
		color: semanticColors.textTertiary,
	},
	error: {
		marginTop: spacing.md,
		padding: spacing.md,
		borderRadius: radii.lg,
		fontSize: "0.875rem",
		color: semanticColors.error,
		backgroundColor: semanticColors.errorBg,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: semanticColors.errorBorder,
	},
	footer: {
		display: "flex",
		justifyContent: "flex-end",
		gap: spacing.sm,
		marginTop: spacing.xl,
	},
	button: {
		paddingTop: spacing.sm,
		paddingBottom: spacing.sm,
		paddingLeft: spacing.lg,
		paddingRight: spacing.lg,
		borderRadius: radii.full,
		fontSize: "0.875rem",
		fontWeight: 600,
		border: "none",
		cursor: "pointer",
		transition: "all 0.15s",
		":disabled": {
			opacity: 0.5,
			cursor: "not-allowed",
		},
	},
	secondaryButton: {
		backgroundColor: semanticColors.bgSecondary,
		color: semanticColors.textSecondary,
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
	},
	dangerButton: {
		backgroundColor: colors.red600,
		color: colors.white,
		":hover": {
			backgroundColor: colors.red700,
		},
	},
	success: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		textAlign: "center",
		gap: spacing.md,
		paddingTop: spacing.md,
		paddingBottom: spacing.md,
		color: semanticColors.textPrimary,
	},
	successIcon: {
		color: semanticColors.success,
	},
	// Trigger button: matches the card action icon buttons
	trigger: {
		display: "flex",
		alignItems: "center",
		padding: spacing.sm,
		borderRadius: radii.full,
		backgroundColor: "transparent",
		border: "none",
		cursor: "pointer",
		color: semanticColors.textTertiary,
		transition: "all 0.2s",
		":hover": {
			color: colors.red500,
			backgroundColor: semanticColors.errorBg,
		},
	},
	triggerCompact: {
		padding: "0.375rem",
	},
	triggerLabelled: {
		gap: spacing.xs,
		paddingLeft: spacing.md,
		paddingRight: spacing.md,
		fontSize: "0.8125rem",
		fontWeight: 600,
		borderRadius: radii.lg,
		borderWidth: "1.5px",
		borderStyle: "solid",
		borderColor: semanticColors.borderSubtle,
	},
});

const TARGET_LABEL: Record<ReportTargetType, string> = {
	post: "post",
	comment: "comment",
	user: "user",
};

interface ReportDialogProps {
	targetType: ReportTargetType;
	targetId: string;
	onClose: () => void;
}

export function ReportDialog({ targetType, targetId, onClose }: ReportDialogProps) {
	const titleId = useId();
	const descId = useId();
	const detailsId = useId();
	const [reason, setReason] = useState<string>("");
	const [details, setDetails] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);
	const dialogRef = useRef<HTMLDivElement>(null);
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;

	// Escape closes; focus moves into the dialog and back to the trigger on close.
	useEffect(() => {
		const previouslyFocused = document.activeElement as HTMLElement | null;
		dialogRef.current?.querySelector<HTMLElement>("input, button, textarea")?.focus();

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				onCloseRef.current();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			previouslyFocused?.focus?.();
		};
	}, []);

	// Move focus to the Close button once the confirmation replaces the form.
	useEffect(() => {
		if (submitted) {
			dialogRef.current?.querySelector<HTMLElement>("[data-report-close]")?.focus();
		}
	}, [submitted]);

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!reason || submitting) return;
		setSubmitting(true);
		setError(null);
		try {
			await reportContent({
				data: { targetType, targetId, reason, description: details.trim() || undefined },
			});
			setSubmitted(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit report");
		} finally {
			setSubmitting(false);
		}
	};

	const label = TARGET_LABEL[targetType];

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-dismiss; Escape is handled on document
		<div
			{...stylex.props(styles.backdrop)}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descId}
				{...stylex.props(styles.dialog)}
			>
				<div {...stylex.props(styles.header)}>
					<div>
						<h2 id={titleId} {...stylex.props(styles.title)}>
							Report {label}
						</h2>
						<p id={descId} {...stylex.props(styles.subtitle)}>
							{submitted
								? "Your report has been submitted."
								: `Tell us what's wrong with this ${label}. Reports are reviewed by moderators.`}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						title="Close"
						{...stylex.props(styles.closeButton)}
					>
						<X size={18} />
					</button>
				</div>

				{submitted ? (
					<div {...stylex.props(styles.success)}>
						<CheckCircle2 size={40} {...stylex.props(styles.successIcon)} />
						<output>Thanks — a moderator will review this.</output>
						<button
							type="button"
							data-report-close
							onClick={onClose}
							{...stylex.props(styles.button, styles.secondaryButton)}
						>
							Done
						</button>
					</div>
				) : (
					<form onSubmit={handleSubmit}>
						<fieldset {...stylex.props(styles.fieldset)}>
							<legend {...stylex.props(styles.legend)}>Reason</legend>
							<div {...stylex.props(styles.reasons)}>
								{REPORT_REASONS.map((r) => (
									<label
										key={r}
										{...stylex.props(
											styles.reasonOption,
											reason === r && styles.reasonOptionSelected,
										)}
									>
										<input
											type="radio"
											name="report-reason"
											value={r}
											checked={reason === r}
											onChange={() => setReason(r)}
											{...stylex.props(styles.radio)}
										/>
										{r}
									</label>
								))}
							</div>
						</fieldset>

						<label htmlFor={detailsId} {...stylex.props(styles.detailsLabel)}>
							Details <span {...stylex.props(styles.optional)}>(optional)</span>
						</label>
						<textarea
							id={detailsId}
							value={details}
							maxLength={DETAILS_MAX}
							onChange={(e) => setDetails(e.target.value)}
							placeholder="Add any context that will help a moderator"
							{...stylex.props(styles.textarea)}
						/>
						<div {...stylex.props(styles.counter)}>
							{details.length}/{DETAILS_MAX}
						</div>

						{error && (
							<div role="alert" {...stylex.props(styles.error)}>
								{error}
							</div>
						)}

						<div {...stylex.props(styles.footer)}>
							<button
								type="button"
								onClick={onClose}
								{...stylex.props(styles.button, styles.secondaryButton)}
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={!reason || submitting}
								{...stylex.props(styles.button, styles.dangerButton)}
							>
								{submitting ? "Submitting…" : "Submit report"}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>,
		document.body,
	);
}

interface ReportButtonProps {
	targetType: ReportTargetType;
	targetId: string;
	/** Icon size; comments use a smaller icon than posts. */
	size?: number;
	/** Smaller padding to line up with comment action buttons. */
	compact?: boolean;
	/** Show a "Report" text label next to the icon (profile header). */
	showLabel?: boolean;
}

/** Flag icon button that opens the report dialog. */
export function ReportButton({
	targetType,
	targetId,
	size = 16,
	compact = false,
	showLabel = false,
}: ReportButtonProps) {
	const [open, setOpen] = useState(false);
	const label = `Report ${TARGET_LABEL[targetType]}`;

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				title={label}
				aria-label={label}
				aria-haspopup="dialog"
				{...stylex.props(
					styles.trigger,
					compact && styles.triggerCompact,
					showLabel && styles.triggerLabelled,
				)}
			>
				<Flag size={size} />
				{showLabel && <span>Report</span>}
			</button>
			{open && (
				<ReportDialog targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />
			)}
		</>
	);
}
