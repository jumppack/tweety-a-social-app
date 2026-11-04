import * as stylex from "@stylexjs/stylex";
import { useId, useState } from "react";
import { type AdminReport, type ReviewAction, reviewReport } from "../../server/functions/reports";
import { colors, radii, semanticColors, spacing } from "../../tokens.stylex";
import { Dialog } from "../users/UserActionDialogs";

const styles = stylex.create({
	label: {
		display: "block",
		fontSize: "0.875rem",
		fontWeight: 500,
		color: semanticColors.textPrimary,
		marginBottom: spacing.xs,
	},
	field: {
		width: "100%",
		padding: spacing.sm,
		borderRadius: radii.md,
		border: `1px solid ${semanticColors.borderDefault}`,
		backgroundColor: semanticColors.surfaceInput,
		color: semanticColors.textPrimary,
		fontSize: "0.875rem",
		fontFamily: "inherit",
		":focus": {
			outline: "none",
			borderColor: semanticColors.borderFocus,
		},
	},
	error: {
		marginTop: spacing.md,
		padding: spacing.sm,
		borderRadius: radii.md,
		backgroundColor: semanticColors.errorBg,
		color: semanticColors.error,
		fontSize: "0.875rem",
	},
	footer: {
		display: "flex",
		justifyContent: "flex-end",
		gap: spacing.sm,
		marginTop: spacing.xl,
	},
	button: {
		paddingBlock: spacing.sm,
		paddingInline: spacing.lg,
		borderRadius: radii.md,
		border: "none",
		fontSize: "0.875rem",
		fontWeight: 500,
		cursor: "pointer",
		":disabled": {
			opacity: 0.6,
			cursor: "not-allowed",
		},
	},
	secondary: {
		backgroundColor: semanticColors.bgSecondary,
		color: semanticColors.textPrimary,
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
	},
	danger: {
		backgroundColor: colors.red600,
		color: colors.white,
		":hover": {
			backgroundColor: colors.red700,
		},
	},
	primary: {
		backgroundColor: semanticColors.primary,
		color: semanticColors.textOnPrimary,
		":hover": {
			backgroundColor: semanticColors.primaryHover,
		},
	},
});

function copyFor(report: AdminReport, action: ReviewAction) {
	const type = report.targetType;
	const author = report.targetAuthorUsername ? `@${report.targetAuthorUsername}` : "the author";
	switch (action) {
		case "dismiss":
			return {
				title: "Dismiss this report?",
				description: `The ${type} stays as it is and the report moves to Dismissed.`,
				confirm: "Dismiss report",
				danger: false,
			};
		case "remove_content":
			return report.targetExists
				? {
						title: `Remove this ${type}?`,
						description: `The ${type} is deleted for everyone, and every pending report about it is marked resolved.`,
						confirm: `Remove ${type}`,
						danger: true,
					}
				: {
						title: "Mark this report resolved?",
						description: `The ${type} was already deleted. Its pending reports will be marked resolved.`,
						confirm: "Mark resolved",
						danger: false,
					};
		case "ban_user":
			return {
				title: `Ban ${author}?`,
				description: `${author} will be unable to sign in until unbanned, and this report is marked resolved.`,
				confirm: "Confirm ban",
				danger: true,
			};
	}
}

export function ReviewReportDialog({
	report,
	action,
	onClose,
	onDone,
}: {
	report: AdminReport;
	action: ReviewAction;
	onClose: () => void;
	onDone: (action: ReviewAction) => void;
}) {
	const [notes, setNotes] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const notesId = useId();
	const copy = copyFor(report, action);

	const submit = async () => {
		setPending(true);
		setError("");
		try {
			await reviewReport({ data: { reportId: report.id, action, notes } });
			onDone(action);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setPending(false);
		}
	};

	return (
		<Dialog title={copy.title} description={copy.description} onClose={onClose}>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<label htmlFor={notesId} {...stylex.props(styles.label)}>
					Notes (optional)
				</label>
				<textarea
					id={notesId}
					name="notes"
					rows={3}
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					placeholder="Shown in the audit log"
					{...stylex.props(styles.field)}
				/>
				{error && (
					<p role="alert" {...stylex.props(styles.error)}>
						{error}
					</p>
				)}
				<div {...stylex.props(styles.footer)}>
					<button
						type="button"
						onClick={onClose}
						{...stylex.props(styles.button, styles.secondary)}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={pending}
						{...stylex.props(styles.button, copy.danger ? styles.danger : styles.primary)}
					>
						{pending ? "Saving…" : copy.confirm}
					</button>
				</div>
			</form>
		</Dialog>
	);
}
