import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

export interface RequestStore {
	traceId: string;
	method: string;
	startTime: number;
	userId?: string;
}

/**
 * AsyncLocalStorage for propagating request tracing context across asynchronous call stacks.
 */
export const requestContext = new AsyncLocalStorage<RequestStore>();

export function generateTraceId(): string {
	return randomUUID();
}

export function getTraceId(): string | undefined {
	return requestContext.getStore()?.traceId;
}

export function getCurrentTraceId(): string {
	return getTraceId() || "no-trace-id";
}
