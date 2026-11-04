import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
	BannedAccountError,
	ConflictError,
	NotFoundError,
	UnauthenticatedError,
} from "../errors/app-error";
import { type AuthContext, createSessionToken } from "../middleware/auth";
import { generateId, hashPassword, verifyPasswordDetails } from "./utils";

const { users } = schema;

// Well-formed scrypt hash (zero salt/key); used only to equalise timing for unknown emails.
const DUMMY_PASSWORD_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

export interface RegisterInput {
	email: string;
	username: string;
	displayName: string;
	password: string;
}

export interface LoginInput {
	email: string;
	password: string;
}

export async function registerUser(input: RegisterInput) {
	// Check if email already exists
	const existingEmail = await db.select().from(users).where(eq(users.email, input.email)).get();

	if (existingEmail) {
		throw new ConflictError("User with this email already exists");
	}

	// Check if username already exists
	const existingUsername = await db
		.select()
		.from(users)
		.where(eq(users.username, input.username))
		.get();

	if (existingUsername) {
		throw new ConflictError("Username already taken");
	}

	// Hash password
	const passwordHash = await hashPassword(input.password);

	// Create user
	const userId = generateId();
	await db.insert(users).values({
		id: userId,
		email: input.email,
		username: input.username,
		displayName: input.displayName,
		passwordHash,
		role: "user",
	});

	// Create session token
	const sessionToken = createSessionToken({
		userId,
		username: input.username,
		role: "user",
	});

	return { userId, sessionToken };
}

export async function loginUser(input: LoginInput) {
	// Find user by email
	const user = await db.select().from(users).where(eq(users.email, input.email)).get();

	if (!user) {
		// Burn the same scrypt work as a real verification so response timing does not reveal
		// whether the email is registered.
		await verifyPasswordDetails(input.password, DUMMY_PASSWORD_HASH);
		throw new UnauthenticatedError("Invalid email or password");
	}

	// Verify the password BEFORE revealing any account state. Checking the ban first would let
	// anyone probe whether an email is banned without knowing the password.
	const { valid, isLegacy } = await verifyPasswordDetails(input.password, user.passwordHash);
	if (!valid) {
		throw new UnauthenticatedError("Invalid email or password");
	}

	// Only a caller who has proved knowledge of the password learns that the account is banned.
	if (user.bannedAt) {
		throw new BannedAccountError(user.bannedReason);
	}

	// Transparently upgrade legacy SHA-256 password hash to scrypt upon successful login
	if (isLegacy) {
		const newPasswordHash = await hashPassword(input.password);
		await db.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, user.id));
	}

	// Create session token
	const sessionToken = createSessionToken({
		userId: user.id,
		username: user.username,
		role: user.role as AuthContext["role"],
	});

	return { userId: user.id, sessionToken };
}

export async function getCurrentUser(userId: string) {
	const user = await db
		.select({
			id: users.id,
			email: users.email,
			username: users.username,
			displayName: users.displayName,
			avatarUrl: users.avatarUrl,
			bio: users.bio,
			role: users.role,
			createdAt: users.createdAt,
		})
		.from(users)
		.where(eq(users.id, userId))
		.get();

	if (!user) {
		throw new NotFoundError("User not found");
	}

	return user;
}
