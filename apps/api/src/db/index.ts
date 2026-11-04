import { createClient } from "@libsql/client";
import * as schema from "@tweety/db-schema";
import { drizzle } from "drizzle-orm/libsql";

const client = createClient({
	url: process.env.DATABASE_URL || "file:./tweety.db",
});

export const db = drizzle(client, { schema });

export { schema };
