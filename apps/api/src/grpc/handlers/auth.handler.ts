import type { IAuthService } from "@tweety/proto";
import { validateSessionToken } from "../../middleware/auth";
import { getCurrentUser, loginUser, registerUser } from "../../services/auth.service";
import { toProtoTimestamp } from "../../services/utils";
import { withObservability } from "../observability";

/**
 */
export const authHandler: IAuthService = {
	register: withObservability("AuthService/register", async (request) => {
		try {
			const result = await registerUser({
				email: request.email,
				username: request.username,
				displayName: request.displayName,
				password: request.password,
			});

			return {
				success: true,
				userId: result.userId,
				sessionToken: result.sessionToken,
			};
		} catch (error) {
			return {
				success: false,
				userId: "",
				sessionToken: "",
				error: error instanceof Error ? error.message : "Registration failed",
			};
		}
	}),

	login: withObservability("AuthService/login", async (request) => {
		try {
			const result = await loginUser({
				email: request.email,
				password: request.password,
			});

			return {
				success: true,
				userId: result.userId,
				sessionToken: result.sessionToken,
			};
		} catch (error) {
			return {
				success: false,
				userId: "",
				sessionToken: "",
				error: error instanceof Error ? error.message : "Login failed",
			};
		}
	}),

	logout: withObservability("AuthService/logout", async (_request) => {
		return { success: true };
	}),

	getCurrentUser: withObservability("AuthService/getCurrentUser", async (request) => {
		const auth = validateSessionToken(request.sessionToken);
		const user = await getCurrentUser(auth.userId);

		return {
			id: user.id,
			email: user.email,
			username: user.username,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl || undefined,
			bio: user.bio || undefined,
			role: user.role,
			createdAt: toProtoTimestamp(user.createdAt),
		};
	}),

	validateSession: withObservability("AuthService/validateSession", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			return {
				valid: true,
				userId: auth.userId,
				username: auth.username,
				role: auth.role,
			};
		} catch {
			return {
				valid: false,
				userId: "",
				username: "",
				role: "",
			};
		}
	}),
};
