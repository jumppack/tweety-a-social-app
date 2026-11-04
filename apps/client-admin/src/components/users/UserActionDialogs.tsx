import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useEffect, useId, useState } from "react";
import { type AdminRole, banUser, unbanUser, updateUserRole } from "../../server/functions/users";
import { colors, radii, semanticColors, spacing } from "../../tokens.stylex";

/** Minimal shape both the list and detail pages can pass in. */
export interface ActionTarget {
	id: string;
	displayName: string;
	username: string;
	role: AdminRole;
	bannedAt: Date | null;
}

export interface ActingAdmin {
	id: string;
	role: "admin" | "moderator";
}

/**
 * Mirrors the API's rules (admin.service / admin.handler) so the UI disables
 * actions the server would reject, with the reason as a tooltip.
 */
export function getPermissions(target: ActionTarget, actor: ActingAdmin | null) {
	const isSelf = actor?.id === target.id;
	const banBlockedReason = !actor
		? "Not signed in"
		: isSelf
			? "You cannot ban yourself"
			: target.role === "admin" && !target.bannedAt
				? "Admins cannot be banned"
				: null;
	const roleBlockedReason = !actor
		? "Not signed in"
		: actor.role !== "admin"
			? "Only admins can change roles"
			: isSelf
				? "You cannot change your own role"
				: null;
	return { banBlockedReason, roleBlockedReason };
}

const styles = stylex.create({
	backdrop: {
		position: "fixed",
		inset: 0,
		backgroundColor: "rgba(15, 23, 42, 0.45)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: spacing.lg,
		zIndex: 50,
	},
	dialog: {
		width: "100%",
		maxWidth: "28rem",
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.lg,
		border: `1px solid ${semanticColors.borderSubtle}`,
		boxShadow: "0 20px 40px -12px rgba(15, 23, 42, 0.35)",
		padding: spacing.xl,
	},
	title: {
		fontSize: "1.125rem",
		fontWeight: 600,
		color: semanticColors.textPrimary,
		marginBottom: spacing.sm,
	},
	body: {
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
		marginBottom: spacing.lg,
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
	primary: {
		backgroundColor: semanticColors.primary,
		color: semanticColors.textOnPrimary,
		":hover": {
			backgroundColor: semanticColors.primaryHover,
		},
	},
});

export function Dialog({
	title,
	description,
	onClose,
	children,
}: {
	title: string;
	description: ReactNode;
	onClose: () => void;
	children: ReactNode;
}) {
	const titleId = useId();
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: Escape is handled on window; clicking the backdrop is a mouse shortcut for Cancel
		<div
			{...stylex.props(styles.backdrop)}
			onClick={(e) => e.target === e.currentTarget && onClose()}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				{...stylex.props(styles.dialog)}
			>
				<h2 id={titleId} {...stylex.props(styles.title)}>
					{title}
				</h2>
				<div {...stylex.props(styles.body)}>{description}</div>
				{children}
			</div>
		</div>
	);
}

function useSubmit(action: () => Promise<unknown>, onDone: () => void) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const submit = async () => {
		setPending(true);
		setError("");
		try {
			await action();
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setPending(false);
		}
	};
	return { pending, error, submit };
}

/** Ban (with a required reason) or, for an already-banned user, unban. */
export function BanUserDialog({
	user,
	onClose,
	onDone,
}: {
	user: ActionTarget;
	onClose: () => void;
	onDone: () => void;
}) {
	const isBanned = !!user.bannedAt;
	const [reason, setReason] = useState("");
	const reasonId = useId();
	const { pending, error, submit } = useSubmit(
		() =>
			isBanned ? unbanUser({ data: user.id }) : banUser({ data: { userId: user.id, reason } }),
		onDone,
	);

	return (
		<Dialog
			title={isBanned ? `Unban ${user.displayName}?` : `Ban ${user.displayName}?`}
			description={
				isBanned
					? `@${user.username} will be able to sign in and post again.`
					: `@${user.username} will be unable to sign in until unbanned.`
			}
			onClose={onClose}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				{!isBanned && (
					<>
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
					</>
				)}
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
						disabled={pending || (!isBanned && !reason.trim())}
						{...stylex.props(styles.button, isBanned ? styles.primary : styles.danger)}
					>
						{pending ? "Saving…" : isBanned ? "Confirm unban" : "Confirm ban"}
					</button>
				</div>
			</form>
		</Dialog>
	);
}

const ROLES: AdminRole[] = ["user", "moderator", "admin"];

export function ChangeRoleDialog({
	user,
	onClose,
	onDone,
}: {
	user: ActionTarget;
	onClose: () => void;
	onDone: () => void;
}) {
	const [role, setRole] = useState<AdminRole>(user.role);
	const roleId = useId();
	const { pending, error, submit } = useSubmit(
		() => updateUserRole({ data: { userId: user.id, role } }),
		onDone,
	);

	return (
		<Dialog
			title={`Change role for ${user.displayName}`}
			description={`Current role: ${user.role}. Admins can manage roles; moderators can moderate content and ban users.`}
			onClose={onClose}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<label htmlFor={roleId} {...stylex.props(styles.label)}>
					New role
				</label>
				<select
					id={roleId}
					name="role"
					value={role}
					onChange={(e) => setRole(e.target.value as AdminRole)}
					{...stylex.props(styles.field)}
				>
					{ROLES.map((r) => (
						<option key={r} value={r}>
							{r}
						</option>
					))}
				</select>
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
						disabled={pending || role === user.role}
						{...stylex.props(styles.button, styles.primary)}
					>
						{pending ? "Saving…" : "Save role"}
					</button>
				</div>
			</form>
		</Dialog>
	);
}
