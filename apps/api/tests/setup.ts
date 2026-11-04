import { beforeEach, vi } from "vitest";

// Mock the database module before any imports
vi.mock("../src/db", async () => {
	const { drizzle } = await import("drizzle-orm/libsql");
	const { createClient } = await import("@libsql/client");
	const schema = await import("@tweety/db-schema");

	// Create a unique in-memory database for each test file
	const client = createClient({
		url: ":memory:",
	});

	const db = drizzle(client, { schema });

	// Build the schema from the real Drizzle migrations so tests can never drift
	// from production (previously this file hand-copied CREATE TABLE statements).
	const { migrate } = await import("drizzle-orm/libsql/migrator");
	const { fileURLToPath } = await import("node:url");
	await migrate(db, {
		migrationsFolder: fileURLToPath(new URL("../../../db/migrations", import.meta.url)),
	});

	return { db, schema, client };
});

// Clean up database before each test
beforeEach(async () => {
	const { client } = await import("../src/db");
	// Clear all tables in reverse order of dependencies
	await (client as any).execute("DELETE FROM audit_logs");
	await (client as any).execute("DELETE FROM reports");
	await (client as any).execute("DELETE FROM notifications");
	await (client as any).execute("DELETE FROM bookmarks");
	await (client as any).execute("DELETE FROM follows");
	await (client as any).execute("DELETE FROM likes");
	await (client as any).execute("DELETE FROM comments");
	await (client as any).execute("DELETE FROM posts");
	await (client as any).execute("DELETE FROM users");
});
