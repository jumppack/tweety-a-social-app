import { requestContext } from "./context";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export interface LogPayload {
	timestamp: string;
	level: LogLevel;
	traceId?: string;
	method?: string;
	durationMs?: number;
	userId?: string;
	message: string;
	error?: string;
	[key: string]: unknown;
}

/**
 * Production-ready JSON Structured Logger.
 * Automatically injects traceId and request context from AsyncLocalStorage.
 */
export const logger = {
	log(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
		const store = requestContext.getStore();
		const payload: LogPayload = {
			timestamp: new Date().toISOString(),
			level,
			traceId: store?.traceId || (meta.traceId as string) || undefined,
			method: store?.method || (meta.method as string) || undefined,
			durationMs: store ? Number((performance.now() - store.startTime).toFixed(2)) : undefined,
			userId: store?.userId || (meta.userId as string) || undefined,
			message,
			...meta,
		};

		// Output clean JSON format for log collectors
		console.log(JSON.stringify(payload));
	},

	info(message: string, meta: Record<string, unknown> = {}) {
		this.log("INFO", message, meta);
	},

	warn(message: string, meta: Record<string, unknown> = {}) {
		this.log("WARN", message, meta);
	},

	error(message: string, meta: Record<string, unknown> = {}) {
		this.log("ERROR", message, meta);
	},

	debug(message: string, meta: Record<string, unknown> = {}) {
		this.log("DEBUG", message, meta);
	},
};
