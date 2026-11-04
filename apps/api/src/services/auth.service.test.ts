import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestUser } from "../../tests/helpers";
import { db, schema } from "../db";
import { ConflictError, UnauthenticatedError } from "../errors/app-error";
import { loginUser, registerUser } from "./auth.service";

const { users } = schema;

describe("AuthService", () => {
	describe("registerUser", () => {
		it("registers a new user with valid input", async () => {
			const result = await registerUser({
				email: "new@example.com",
				username: "newuser",
				displayName: "New User",
				password: "password123",
			});

			expect(result.userId).toBeDefined();
			expect(result.sessionToken).toBeDefined();

			// Verify user was created in database
			const user = await db.select().from(users).where(eq(users.id, result.userId)).get();

			expect(user).toBeDefined();
			expect(user?.email).toBe("new@example.com");
			expect(user?.username).toBe("newuser");
			expect(user?.role).toBe("user");
		});

		it("rejects duplicate email", async () => {
			await createTestUser({ email: "taken@example.com" });

			await expect(
				registerUser({
					email: "taken@example.com",
					username: "newuser",
					displayName: "New User",
					password: "password123",
				}),
			).rejects.toThrow("User with this email already exists");
		});

		it("rejects duplicate username", async () => {
			await createTestUser({ username: "takenname" });

			await expect(
				registerUser({
					email: "new@example.com",
					username: "takenname",
					displayName: "New User",
					password: "password123",
				}),
			).rejects.toThrow("Username already taken");
		});
	});

	describe("loginUser", () => {
		it("logs in with valid credentials", async () => {
			await createTestUser({
				email: "login@example.com",
				password: "correctpassword",
			});

			const result = await loginUser({
				email: "login@example.com",
				password: "correctpassword",
			});

			expect(result.userId).toBeDefined();
			expect(result.sessionToken).toBeDefined();
		});

		it("rejects invalid email", async () => {
			await expect(
				loginUser({
					email: "nonexistent@example.com",
					password: "password123",
				}),
			).rejects.toThrow("Invalid email or password");
		});

		it("rejects invalid password", async () => {
			await createTestUser({
				email: "user@example.com",
				password: "correctpassword",
			});

			await expect(
				loginUser({
					email: "user@example.com",
					password: "wrongpassword",
				}),
			).rejects.toThrow("Invalid email or password");
		});

		it("rejects banned user", async () => {
			const user = await createTestUser({
				email: "banned@example.com",
				password: "password123",
			});

			// Ban the user
			await db
				.update(users)
				.set({
					bannedAt: new Date(),
					bannedReason: "Violated ToS",
				})
				.where(eq(users.id, user.id));

			await expect(
				loginUser({
					email: "banned@example.com",
					password: "password123",
				}),
			).rejects.toThrow("Account banned: Violated ToS");
		});

		it("does not reveal ban status to a caller with the wrong password", async () => {
			const user = await createTestUser({
				email: "banned-probe@example.com",
				password: "password123",
			});
			await db
				.update(users)
				.set({ bannedAt: new Date(), bannedReason: "Violated ToS" })
				.where(eq(users.id, user.id));

			// Before the fix this threw "Account banned: Violated ToS" for ANY password,
			// letting an attacker enumerate banned accounts by email alone.
			const attempt = loginUser({ email: "banned-probe@example.com", password: "wrong-password" });
			await expect(attempt).rejects.toThrow("Invalid email or password");
			await expect(attempt).rejects.toBeInstanceOf(UnauthenticatedError);
		});

		it("throws typed errors from the error taxonomy", async () => {
			await expect(
				loginUser({ email: "nobody@example.com", password: "whatever123" }),
			).rejects.toBeInstanceOf(UnauthenticatedError);

			await createTestUser({ email: "dup-typed@example.com", password: "password123" });
			await expect(
				registerUser({
					email: "dup-typed@example.com",
					username: "dup-typed-new",
					displayName: "Dup",
					password: "password123",
				}),
			).rejects.toBeInstanceOf(ConflictError);
		});
	});

	describe("Credential security & migration", () => {
		it("uses scrypt format with unique salt for newly registered users", async () => {
			const res1 = await registerUser({
				email: "scrypt1@example.com",
				username: "scryptuser1",
				displayName: "Scrypt User 1",
				password: "samepassword123",
			});
			const res2 = await registerUser({
				email: "scrypt2@example.com",
				username: "scryptuser2",
				displayName: "Scrypt User 2",
				password: "samepassword123",
			});

			const user1 = await db.select().from(users).where(eq(users.id, res1.userId)).get();
			const user2 = await db.select().from(users).where(eq(users.id, res2.userId)).get();

			expect(user1?.passwordHash).toMatch(/^scrypt\$/);
			expect(user2?.passwordHash).toMatch(/^scrypt\$/);
			// Unique salts ensure identical passwords produce distinct hashes
			expect(user1?.passwordHash).not.toBe(user2?.passwordHash);
		});

		it("logs in legacy SHA-256 user and upgrades hash in DB to scrypt", async () => {
			const legacyPassword = "legacyPassword123";
			const legacyHash = require("crypto")
				.createHash("sha256")
				.update(legacyPassword + "salt")
				.digest("hex");

			const userId = "legacy-user-id-1";
			await db.insert(users).values({
				id: userId,
				email: "legacy@example.com",
				username: "legacyuser",
				displayName: "Legacy User",
				passwordHash: legacyHash,
				role: "user",
			});

			// Verify initial hash in DB is legacy SHA-256
			const beforeUser = await db.select().from(users).where(eq(users.id, userId)).get();
			expect(beforeUser?.passwordHash).toBe(legacyHash);

			// Login with legacy password
			const loginRes = await loginUser({
				email: "legacy@example.com",
				password: legacyPassword,
			});
			expect(loginRes.userId).toBe(userId);

			// Verify password hash in DB was automatically upgraded to scrypt
			const afterUser = await db.select().from(users).where(eq(users.id, userId)).get();
			expect(afterUser?.passwordHash).toMatch(/^scrypt\$/);
			expect(afterUser?.passwordHash).not.toBe(legacyHash);
		});
	});
});
