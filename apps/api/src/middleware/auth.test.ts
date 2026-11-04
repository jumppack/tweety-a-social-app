import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { UnauthenticatedError } from "../errors/app-error";
import {
	createSessionToken,
	JWT_SECRET,
	requireAuth,
	resolveJwtSecret,
	validateSessionToken,
} from "./auth";

/**
 * Trust establishment: previously the clients minted their own session JWTs, so whoever
 * held (or guessed) the shared secret could mint a token for any user/role. Only tokens issued by the
 * API with its own secret may be accepted; everything else must be rejected.
 */
describe("Session token trust", () => {
	it("accepts a token issued by the server", () => {
		const token = createSessionToken({ userId: "user-1", username: "alice", role: "user" });

		expect(validateSessionToken(token)).toEqual({
			userId: "user-1",
			username: "alice",
			role: "user",
		});
		expect(requireAuth(token).userId).toBe("user-1");
	});

	it("rejects a forged admin token signed with a different secret", () => {
		const forged = jwt.sign(
			{ userId: "attacker", username: "attacker", role: "admin" },
			"attacker-controlled-secret-that-is-long-enough",
			{ expiresIn: 3600 },
		);

		expect(() => validateSessionToken(forged)).toThrow(UnauthenticatedError);
		expect(() => validateSessionToken(forged)).toThrow("Invalid or expired session token");
		expect(() => requireAuth(forged)).toThrow(UnauthenticatedError);
	});

	it("rejects a server-signed token whose payload was tampered with (role escalation)", () => {
		const [header, , signature] = createSessionToken({
			userId: "user-1",
			username: "alice",
			role: "user",
		}).split(".");
		const tamperedPayload = Buffer.from(
			JSON.stringify({ userId: "user-1", username: "alice", role: "admin" }),
		).toString("base64url");

		expect(() => validateSessionToken(`${header}.${tamperedPayload}.${signature}`)).toThrow(
			UnauthenticatedError,
		);
	});

	it('rejects an unsigned token (alg "none")', () => {
		const unsigned = jwt.sign({ userId: "attacker", username: "attacker", role: "admin" }, "", {
			algorithm: "none",
		});

		expect(() => validateSessionToken(unsigned)).toThrow(UnauthenticatedError);
	});

	it("rejects an expired server-issued token", () => {
		const expired = jwt.sign(
			{
				userId: "user-1",
				username: "alice",
				role: "user",
				exp: Math.floor(Date.now() / 1000) - 10,
			},
			JWT_SECRET,
		);

		expect(() => validateSessionToken(expired)).toThrow(UnauthenticatedError);
	});

	it("requireAuth rejects a missing token", () => {
		expect(() => requireAuth(undefined)).toThrow("Authentication required");
	});
});

describe("resolveJwtSecret", () => {
	it("uses GRPC_JWT_SECRET when set", () => {
		expect(resolveJwtSecret({ NODE_ENV: "production", GRPC_JWT_SECRET: "from-env-secret" })).toBe(
			"from-env-secret",
		);
	});

	it("refuses to start in production without GRPC_JWT_SECRET", () => {
		expect(() => resolveJwtSecret({ NODE_ENV: "production" })).toThrow(
			"GRPC_JWT_SECRET must be set in production",
		);
	});

	it("falls back to the development secret outside production", () => {
		expect(resolveJwtSecret({ NODE_ENV: "test" })).toBe(
			"tweety-grpc-jwt-secret-key-at-least-32-chars",
		);
	});
});
