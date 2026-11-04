import * as stylex from "@stylexjs/stylex";
import { useId, useState } from "react";
import { deleteComment, deletePost } from "../../server/functions/content";
import { colors, radii, semanticColors, spacing } from "../../tokens.stylex";
import { Dialog } from "../users/UserActionDialogs";

const styles = stylex.create({
	preview: {
		marginTop: spacing.sm,
		padding: spacing.sm,
		borderRadius: radii.md,
		backgroundColor: semanticColors.bgSecondary,
		color: semanticColors.textSecondary,
		fontSize: "0.8125rem",
		overflow: "hidden",
		textOverflow: "ellipsis",
		display: "-webkit-box",
		WebkitLineClamp: 3,
		WebkitBoxOrient: "vertical",
	},
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
});

export interface DeleteTarget {
	kind: "post" | "comment";
	id: string;
	content: string;
	authorUsername: string;
}

/**
 * Confirm deleting a post or comment. A reason is required: it is recorded in
 * the audit log. `onDone` runs only after the server confirms the delete.
 */
export function DeleteContentDialog({
	target,
	onClose,
	onDone,
}: {
	target: DeleteTarget;
	onClose: () => void;
	onDone: () => void;
}) {
	const [reason, setReason] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const reasonId = useId();
	const noun = target.kind === "post" ? "post" : "comment";

	const submit = async () => {
		if (!reason.trim()) {
			setError("Please give a reason for the audit log.");
			return;
		}
		setPending(true);
		setError("");
		try {
			if (target.kind === "post") {
				await deletePost({ data: { postId: target.id, reason } });
			} else {
				await deleteComment({ data: { commentId: target.id, reason } });
			}
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setPending(false);
		}
	};

	return (
		<Dialog
			title={`Delete ${noun}?`}
			description={
				<>
					This permanently removes the {noun} by @{target.authorUsername}
					{target.kind === "post" ? " and its comments" : ""}.
					<span {...stylex.props(styles.preview)}>{target.content}</span>
				</>
			}
			onClose={pending ? () => {} : onClose}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<label htmlFor={reasonId} {...stylex.props(styles.label)}>
					Reason
				</label>
				<textarea
					id={reasonId}
					name="reason"
					rows={3}
					required
					value={reason}
					onChange={(e) => setReason(e.target.value)}
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
						disabled={pending}
						{...stylex.props(styles.button, styles.secondary)}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={pending || !reason.trim()}
						{...stylex.props(styles.button, styles.danger)}
					>
						{pending ? "Deleting…" : `Delete ${noun}`}
					</button>
				</div>
			</form>
		</Dialog>
	);
}
