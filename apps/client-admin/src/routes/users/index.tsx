import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, Eye, MoreVertical, Search, Shield, ShieldCheck, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	BanUserDialog,
	ChangeRoleDialog,
	getPermissions,
} from "../../components/users/UserActionDialogs";
import { requireAdminAccess } from "../../lib/auth-guard";
import { type AdminUser, listUsers } from "../../server/functions/users";
import { colors, radii, semanticColors, spacing } from "../../tokens.stylex";
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
		marginBottom: spacing.xl,
	},
	title: {
		fontSize: "1.875rem",
		fontWeight: 700,
		color: semanticColors.textPrimary,
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
	table: {
		width: "100%",
		backgroundColor: semanticColors.surfaceCard,
		borderRadius: radii.lg,
		border: `1px solid ${semanticColors.borderSubtle}`,
		overflow: "hidden",
	},
	tableHeader: {
		backgroundColor: semanticColors.bgSecondary,
	},
	tableRow: {
		borderBottom: `1px solid ${semanticColors.borderSubtle}`,
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
	},
	tableRowLast: {
		borderBottom: "none",
	},
	th: {
		textAlign: "left",
		padding: spacing.md,
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
		fontWeight: 600,
		textTransform: "uppercase",
		letterSpacing: "0.05em",
	},
	td: {
		padding: spacing.md,
		color: semanticColors.textSecondary,
		fontSize: "0.875rem",
	},
	userCell: {
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
	avatarImg: {
		width: "40px",
		height: "40px",
		borderRadius: "50%",
		objectFit: "cover",
	},
	userInfo: {
		display: "flex",
		flexDirection: "column",
	},
	userName: {
		color: semanticColors.textPrimary,
		fontWeight: 500,
	},
	userHandle: {
		color: semanticColors.textTertiary,
		fontSize: "0.75rem",
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
		backgroundColor: colors.slate700,
		color: colors.slate300,
	},
	badgeModerator: {
		backgroundColor: colors.blue900,
		color: colors.blue400,
	},
	badgeAdmin: {
		backgroundColor: "#581c87",
		color: "#c084fc",
	},
	badgeBanned: {
		backgroundColor: colors.red900,
		color: colors.red400,
	},
	statusActive: {
		color: colors.green400,
	},
	statusBanned: {
		color: colors.red400,
	},
	actionsCell: {
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
		padding: spacing.sm,
		borderRadius: radii.md,
		textDecoration: "none",
		color: semanticColors.textTertiary,
		":hover": {
			backgroundColor: semanticColors.bgHover,
			color: semanticColors.textPrimary,
		},
	},
	actionButtonDisabled: {
		opacity: 0.35,
		cursor: "not-allowed",
		":hover": {
			backgroundColor: "transparent",
			color: semanticColors.textTertiary,
		},
	},
	menuWrapper: {
		position: "relative",
	},
	menu: {
		// fixed + coordinates from the button: the table has overflow:hidden
		// (for its rounded corners), which clipped an absolutely positioned menu
		position: "fixed",
		minWidth: "11rem",
		backgroundColor: semanticColors.surfaceCard,
		border: `1px solid ${semanticColors.borderSubtle}`,
		borderRadius: radii.md,
		boxShadow: "0 10px 25px -8px rgba(15, 23, 42, 0.25)",
		paddingBlock: spacing.xs,
		zIndex: 20,
	},
	menuItem: {
		display: "flex",
		alignItems: "center",
		gap: spacing.sm,
		width: "100%",
		paddingBlock: spacing.sm,
		paddingInline: spacing.md,
		border: "none",
		backgroundColor: "transparent",
		color: semanticColors.textPrimary,
		fontSize: "0.875rem",
		textAlign: "left",
		textDecoration: "none",
		cursor: "pointer",
		":hover": {
			backgroundColor: semanticColors.bgHover,
		},
		":disabled": {
			color: semanticColors.textTertiary,
			cursor: "not-allowed",
			backgroundColor: "transparent",
		},
	},
	message: {
		padding: spacing.xl,
		textAlign: "center",
		color: semanticColors.textTertiary,
	},
});

export const Route = createFileRoute("/users/")({
	beforeLoad: requireAdminAccess,
	component: UsersPage,
});

type DialogState = { kind: "ban" | "role"; user: AdminUser } | null;

const formatDate = (d: Date) => new Date(d).toISOString().slice(0, 10);

function RowMenu({
	user,
	roleBlockedReason,
	onChangeRole,
}: {
	user: AdminUser;
	roleBlockedReason: string | null;
	onChangeRole: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState({ top: 0, right: 0 });
	const ref = useRef<HTMLDivElement>(null);

	const toggle = (button: HTMLButtonElement) => {
		const rect = button.getBoundingClientRect();
		setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
		setOpen((v) => !v);
	};

	useEffect(() => {
		if (!open) return;
		const close = (e: MouseEvent | KeyboardEvent) => {
			if (
				e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)
			) {
				setOpen(false);
			}
		};
		const dismiss = () => setOpen(false);
		document.addEventListener("mousedown", close);
		document.addEventListener("keydown", close);
		window.addEventListener("scroll", dismiss, true);
		window.addEventListener("resize", dismiss);
		return () => {
			document.removeEventListener("mousedown", close);
			document.removeEventListener("keydown", close);
			window.removeEventListener("scroll", dismiss, true);
			window.removeEventListener("resize", dismiss);
		};
	}, [open]);

	return (
		<div ref={ref} {...stylex.props(styles.menuWrapper)}>
			<button
				type="button"
				title="More actions"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={(e) => toggle(e.currentTarget)}
				{...stylex.props(styles.actionButton)}
			>
				<MoreVertical size={16} />
			</button>
			{open && (
				<div role="menu" style={position} {...stylex.props(styles.menu)}>
					<Link
						to="/users/$userId"
						params={{ userId: user.id }}
						role="menuitem"
						{...stylex.props(styles.menuItem)}
					>
						<Eye size={14} /> View details
					</Link>
					<button
						type="button"
						role="menuitem"
						disabled={!!roleBlockedReason}
						title={roleBlockedReason ?? undefined}
						onClick={() => {
							setOpen(false);
							onChangeRole();
						}}
						{...stylex.props(styles.menuItem)}
					>
						<ShieldCheck size={14} /> Change role…
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							navigator.clipboard?.writeText(user.email);
							setOpen(false);
						}}
						{...stylex.props(styles.menuItem)}
					>
						Copy email
					</button>
				</div>
			)}
		</div>
	);
}

function UsersPage() {
	const admin = useAdminUser();
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [search, setSearch] = useState("");
	const [dialog, setDialog] = useState<DialogState>(null);
	const latestRequest = useRef(0);

	const loadUsers = useCallback(async (query: string) => {
		const requestId = ++latestRequest.current;
		try {
			const result = await listUsers({ data: { search: query } });
			if (requestId !== latestRequest.current) return; // a newer search is in flight
			setUsers(result.users);
			setError("");
		} catch (err) {
			if (requestId === latestRequest.current) {
				setError(err instanceof Error ? err.message : "Failed to load users");
			}
		} finally {
			if (requestId === latestRequest.current) setLoading(false);
		}
	}, []);

	// Debounce search so each keystroke doesn't hit the API
	useEffect(() => {
		const timer = setTimeout(() => loadUsers(search), search ? 250 : 0);
		return () => clearTimeout(timer);
	}, [search, loadUsers]);

	const getRoleBadgeStyle = (role: string) => {
		switch (role) {
			case "admin":
				return styles.badgeAdmin;
			case "moderator":
				return styles.badgeModerator;
			default:
				return styles.badgeUser;
		}
	};

	const closeDialog = () => setDialog(null);
	const afterAction = () => {
		setDialog(null);
		loadUsers(search);
	};

	return (
		<main {...stylex.props(styles.container)}>
			<header {...stylex.props(styles.header)}>
				<h1 {...stylex.props(styles.title)}>Users</h1>
				<div {...stylex.props(styles.searchContainer)}>
					<Search size={16} {...stylex.props(styles.searchIcon)} />
					<input
						type="search"
						placeholder="Search users..."
						aria-label="Search users"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						{...stylex.props(styles.searchInput)}
					/>
				</div>
			</header>

			<table {...stylex.props(styles.table)}>
				<thead {...stylex.props(styles.tableHeader)}>
					<tr>
						<th {...stylex.props(styles.th)}>User</th>
						<th {...stylex.props(styles.th)}>Email</th>
						<th {...stylex.props(styles.th)}>Role</th>
						<th {...stylex.props(styles.th)}>Status</th>
						<th {...stylex.props(styles.th)}>Posts</th>
						<th {...stylex.props(styles.th)}>Joined</th>
						<th {...stylex.props(styles.th)}>Actions</th>
					</tr>
				</thead>
				<tbody>
					{loading || error || users.length === 0 ? (
						<tr>
							<td colSpan={7} {...stylex.props(styles.message)}>
								{loading
									? "Loading users…"
									: error
										? error
										: search
											? `No users match "${search}"`
											: "No users found"}
							</td>
						</tr>
					) : (
						users.map((user, index) => {
							const isLast = index === users.length - 1;
							const RoleIcon = user.role === "user" ? User : Shield;
							const { banBlockedReason, roleBlockedReason } = getPermissions(user, admin);
							const isBanned = !!user.bannedAt;
							return (
								<tr key={user.id} {...stylex.props(styles.tableRow, isLast && styles.tableRowLast)}>
									<td {...stylex.props(styles.td)}>
										<div {...stylex.props(styles.userCell)}>
											<div {...stylex.props(styles.avatar)}>
												{user.avatarUrl ? (
													<img
														src={user.avatarUrl}
														alt={user.displayName}
														{...stylex.props(styles.avatarImg)}
													/>
												) : (
													<User size={20} />
												)}
											</div>
											<div {...stylex.props(styles.userInfo)}>
												<span {...stylex.props(styles.userName)}>{user.displayName}</span>
												<span {...stylex.props(styles.userHandle)}>@{user.username}</span>
											</div>
										</div>
									</td>
									<td {...stylex.props(styles.td)}>{user.email}</td>
									<td {...stylex.props(styles.td)}>
										<span {...stylex.props(styles.badge, getRoleBadgeStyle(user.role))}>
											<RoleIcon size={12} style={{ marginRight: "4px" }} />
											{user.role}
										</span>
									</td>
									<td {...stylex.props(styles.td)}>
										<span
											{...stylex.props(isBanned ? styles.statusBanned : styles.statusActive)}
											title={isBanned ? (user.bannedReason ?? undefined) : undefined}
										>
											{isBanned ? "Banned" : "Active"}
										</span>
									</td>
									<td {...stylex.props(styles.td)}>{user.postCount}</td>
									<td {...stylex.props(styles.td)}>{formatDate(user.createdAt)}</td>
									<td {...stylex.props(styles.td)}>
										<div {...stylex.props(styles.actionsCell)}>
											<Link
												to="/users/$userId"
												params={{ userId: user.id }}
												title="View details"
												aria-label={`View ${user.displayName}`}
												{...stylex.props(styles.viewLink)}
											>
												<Eye size={16} />
											</Link>
											<button
												type="button"
												title={banBlockedReason ?? (isBanned ? "Unban user" : "Ban user")}
												aria-label={`${isBanned ? "Unban" : "Ban"} ${user.displayName}`}
												disabled={!!banBlockedReason}
												onClick={() => setDialog({ kind: "ban", user })}
												{...stylex.props(
													styles.actionButton,
													!!banBlockedReason && styles.actionButtonDisabled,
												)}
											>
												{isBanned ? <ShieldCheck size={16} /> : <Ban size={16} />}
											</button>
											<RowMenu
												user={user}
												roleBlockedReason={roleBlockedReason}
												onChangeRole={() => setDialog({ kind: "role", user })}
											/>
										</div>
									</td>
								</tr>
							);
						})
					)}
				</tbody>
			</table>

			{dialog?.kind === "ban" && (
				<BanUserDialog user={dialog.user} onClose={closeDialog} onDone={afterAction} />
			)}
			{dialog?.kind === "role" && (
				<ChangeRoleDialog user={dialog.user} onClose={closeDialog} onDone={afterAction} />
			)}
		</main>
	);
}
