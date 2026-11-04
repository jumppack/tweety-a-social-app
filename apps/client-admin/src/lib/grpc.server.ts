import { createTweetyClient, type TweetyClient } from "@tweety/grpc-client";
import { getAdminSessionData } from "./session.server";

// gRPC API host
const GRPC_HOST = process.env.GRPC_API_HOST || "localhost:50051";

// Singleton gRPC client
let grpcClient: TweetyClient | null = null;

/**
 * Get or create the gRPC client singleton
 */
export function getGrpcClient(): TweetyClient {
	if (!grpcClient) {
		grpcClient = createTweetyClient({
			host: GRPC_HOST,
			secure: process.env.NODE_ENV === "production",
		});
	}
	return grpcClient;
}

/**
 * Gets the current admin session token for gRPC calls.
 * Returns undefined if user is not authenticated as admin/moderator or lacks a server-issued token.
 * Client does NOT self-sign tokens, establishing single-authority trust with API.
 */
export async function getAdminGrpcSessionToken(): Promise<string | undefined> {
	const session = await getAdminSessionData();
	if (!session?.sessionToken) {
		return undefined;
	}
	return session.sessionToken;
}

/**
 * Gets a required admin session token, throws if not authenticated
 */
export async function requireAdminGrpcSessionToken(): Promise<string> {
	const token = await getAdminGrpcSessionToken();
	if (!token) {
		throw new Error("Admin authentication required");
	}
	return token;
}

/**
 * Helper to convert proto Timestamp to Date
 */
export function fromProtoTimestamp(
	timestamp: { seconds: bigint; nanos: number } | undefined,
): Date {
	if (!timestamp) {
		return new Date();
	}
	return new Date(Number(timestamp.seconds) * 1000 + Math.floor(timestamp.nanos / 1000000));
}
