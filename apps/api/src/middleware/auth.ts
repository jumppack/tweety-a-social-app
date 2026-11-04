import type { GrpcSessionPayload } from "@tweety/shared-types";
import jwt from "jsonwebtoken";
import { ForbiddenError, UnauthenticatedError } from "../errors/app-error";
import { requestContext } from "../utils/context";
import { logger } from "../utils/logger";

const DEV_FALLBACK_JWT_SECRET = "tweety-grpc-jwt-secret-key-at-least-32-chars";

/**
 * Resolves the JWT signing secret. In production a missing GRPC_JWT_SECRET is fatal: falling back to
 * a secret that is committed to the repo would let anyone forge session tokens (including role "admin").
 * Outside production the well-known dev secret is used so local setup keeps working, with a warning.
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
	const secret = env.GRPC_JWT_SECRET;
	if (secret) {
		return secret;
	}
	if (env.NODE_ENV === "production") {
		throw new Error(
			"GRPC_JWT_SECRET must be set in production. Refusing to start with the built-in development secret.",
		);
	}
	if (env.NODE_ENV !== "test") {
		logger.warn(
			"GRPC_JWT_SECRET is not set; using the insecure built-in development secret. Never do this in production.",
		);
	}
	return DEV_FALLBACK_JWT_SECRET;
}

const JWT_SECRET = resolveJwtSecret();

export interface AuthContext {
	userId: string;
	username: string;
	role: "user" | "admin" | "moderator";
}

/**
 * Validates a session token and returns the auth context.
 */
export function validateSessionToken(token: string): AuthContext {
	try {
		// Pin the algorithm so a token cannot pick its own (e.g. "none" or an asymmetric alg confusion).
		const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as GrpcSessionPayload;
		// Attach the authenticated user to the request context so every later log line carries it.
		const store = requestContext.getStore();
		if (store) {
			store.userId = decoded.userId;
		}
		return {
			userId: decoded.userId,
			username: decoded.username,
			role: decoded.role,
		};
	} catch {
		throw new UnauthenticatedError("Invalid or expired session token");
	}
}

/**
 * Creates a session token from auth context
 */
export function createSessionToken(
	context: AuthContext,
	expiresInSeconds: number = 7 * 24 * 60 * 60,
): string {
	return jwt.sign(
		{
			userId: context.userId,
			username: context.username,
			role: context.role,
		},
		JWT_SECRET,
		{ expiresIn: expiresInSeconds },
	);
}

/**
 * Requires authentication - throws if token is invalid
 */
export function requireAuth(token: string | undefined): AuthContext {
	if (!token) {
		throw new UnauthenticatedError("Authentication required");
	}
	return validateSessionToken(token);
}

/**
 * Requires admin or moderator role
 */
export function requireAdmin(context: AuthContext): void {
	if (context.role !== "admin" && context.role !== "moderator") {
		throw new ForbiddenError("Admin access required");
	}
}

/**
 * Requires admin role specifically
 */
export function requireSuperAdmin(context: AuthContext): void {
	if (context.role !== "admin") {
		throw new ForbiddenError("Super admin access required");
	}
}

export { JWT_SECRET };
