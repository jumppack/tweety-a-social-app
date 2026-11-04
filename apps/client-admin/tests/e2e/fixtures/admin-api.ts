import { createTweetyClient } from "@tweety/grpc-client";
import { ADMIN_USERS } from "./test-helpers";

/**
 * Direct gRPC access as an admin, so E2E tests can compare what the admin UI
 * shows with what the API returns right now (other suites mutate the same
 * database concurrently, so values captured earlier go stale).
 */

const client = () => createTweetyClient({ host: process.env.GRPC_API_HOST || "localhost:50051" });

let cachedToken: Promise<string> | null = null;

export function adminSessionToken(): Promise<string> {
	cachedToken ??= (async () => {
		const { email, password } = ADMIN_USERS.admin;
		const { response } = await client().auth.login({ email, password });
		if (!response.success) throw new Error(`admin login failed: ${response.error}`);
		return response.sessionToken;
	})();
	return cachedToken;
}

export async function fetchDashboardStats() {
	const sessionToken = await adminSessionToken();
	const { response } = await client().admin.getDashboardStats({ sessionToken });
	return response;
}

export async function fetchAuditLogs(options: { limit?: number; action?: string } = {}) {
	const sessionToken = await adminSessionToken();
	const { response } = await client().admin.getAuditLogs({
		sessionToken,
		pagination: { limit: options.limit ?? 50, offset: 0 },
		actionFilter: options.action,
	});
	return response;
}

export async function banUserViaApi(userId: string, reason: string) {
	const sessionToken = await adminSessionToken();
	const { response } = await client().admin.banUser({ sessionToken, userId, reason });
	if (!response.success) throw new Error(`banUser failed: ${response.error}`);
}

export async function deletePostViaApi(postId: string, reason: string) {
	const sessionToken = await adminSessionToken();
	const { response } = await client().admin.deletePostAdmin({ sessionToken, postId, reason });
	if (!response.success) throw new Error(`deletePostAdmin failed: ${response.error}`);
}

export async function updateRoleViaApi(userId: string, role: "user" | "moderator" | "admin") {
	const sessionToken = await adminSessionToken();
	const { response } = await client().admin.updateUserRole({ sessionToken, userId, role });
	if (!response.success) throw new Error(`updateUserRole failed: ${response.error}`);
}

export async function reviewReportViaApi(
	reportId: string,
	action: "dismiss" | "remove_content" | "ban_user",
	notes?: string,
) {
	const sessionToken = await adminSessionToken();
	const { response } = await client().admin.reviewReport({ sessionToken, reportId, action, notes });
	if (!response.success) throw new Error(`reviewReport failed: ${response.error}`);
}
