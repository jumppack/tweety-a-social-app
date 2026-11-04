import { status } from "@grpc/grpc-js";
import { RpcError, type RpcMetadata, type ServerCallContext } from "@protobuf-ts/runtime-rpc";
import { AppError } from "../errors/app-error";
import { generateTraceId, requestContext } from "../utils/context";
import { logger } from "../utils/logger";

/** Metadata key used to carry the trace ID in both directions (request headers and response metadata). */
export const TRACE_ID_METADATA_KEY = "x-trace-id";

// Only accept caller-supplied trace IDs that are short and log-safe (no injection into log lines/headers).
const INCOMING_TRACE_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

function resolveTraceId(context?: ServerCallContext): string {
	const incoming = context?.headers?.[TRACE_ID_METADATA_KEY];
	const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
	if (typeof candidate === "string" && INCOMING_TRACE_ID_PATTERN.test(candidate)) {
		return candidate;
	}
	return generateTraceId();
}

function isSoftError(response: unknown): response is { success: false; error?: string } {
	return (
		typeof response === "object" &&
		response !== null &&
		(response as { success?: unknown }).success === false
	);
}

/**
 * Logs an error that a handler deliberately swallows to keep its response contract
 * (e.g. `getBookmarkStatus` returning `{ bookmarked: false }` on failure). Without this the
 * failure would be invisible in production logs. Must be called inside a withObservability scope
 * so the traceId/method are attached automatically.
 */
export function logSwallowedError(error: unknown, fallbackResponse: string): void {
	logger.warn("Handler error swallowed (fallback response returned)", {
		error: error instanceof Error ? error.message : String(error),
		errorType: error instanceof Error ? error.constructor.name : typeof error,
		fallbackResponse,
	});
}

/**
 * gRPC Handler Interceptor / Observability Wrapper.
 *
 * - Establishes a RequestContext (AsyncLocalStorage) so the traceId propagates through the service layer
 *   and is injected into every structured log line.
 * - Reuses a well-formed incoming `x-trace-id` request header (cross-service propagation), otherwise generates one.
 * - Returns the traceId to the client as `x-trace-id` in the initial response metadata (headers), in the
 *   trailing metadata on success, and in the error metadata on failure.
 * - Logs every call exactly once: INFO on success, WARN on a soft error (`success: false` response, the
 *   existing contract is preserved), ERROR on a thrown error.
 * - Maps AppError subclasses to their gRPC status code by throwing an RpcError, which the
 *   @protobuf-ts/grpc-backend adapter translates into a proper gRPC status (a plain Error is always INTERNAL).
 *
 */
export function withObservability<TReq, TRes>(
	methodName: string,
	handler: (request: TReq, context?: ServerCallContext) => Promise<TRes>,
): (request: TReq, context?: ServerCallContext) => Promise<TRes> {
	return async (request: TReq, context?: ServerCallContext): Promise<TRes> => {
		const traceId = resolveTraceId(context);
		const startTime = performance.now();
		const traceMeta: RpcMetadata = { [TRACE_ID_METADATA_KEY]: traceId };

		if (context) {
			try {
				context.sendResponseHeaders(traceMeta);
			} catch {
				// Headers already sent or call cancelled; trailers/error metadata still carry the traceId.
			}
		}

		return requestContext.run({ traceId, method: methodName, startTime }, async () => {
			try {
				const response = await handler(request, context);
				if (context) {
					context.trailers = { ...context.trailers, ...traceMeta };
				}

				if (isSoftError(response)) {
					logger.warn(`gRPC Call Completed with soft error: ${methodName}`, {
						status: "OK",
						outcome: "soft_error",
						error: response.error,
					});
				} else {
					logger.info(`gRPC Call Completed: ${methodName}`, {
						status: "OK",
						outcome: "success",
					});
				}
				return response;
			} catch (error) {
				const errMessage = error instanceof Error ? error.message : String(error);
				const grpcStatus = error instanceof AppError ? error.grpcStatus : status.INTERNAL;
				const statusName = status[grpcStatus] || "INTERNAL";
				const isOperational = error instanceof AppError && error.isOperational;

				const logMeta: Record<string, unknown> = {
					status: statusName,
					grpcStatusCode: grpcStatus,
					outcome: "error",
					errorType: error instanceof Error ? error.constructor.name : typeof error,
					error: errMessage,
				};
				if (isOperational) {
					// Expected domain errors (not found, validation, auth) are client mistakes, not server faults.
					logger.warn(`gRPC Call Failed: ${methodName}`, logMeta);
				} else {
					logger.error(`gRPC Call Failed: ${methodName}`, {
						...logMeta,
						stack: error instanceof Error ? error.stack : undefined,
					});
				}

				// RpcError is the only error type the grpc-backend adapter maps to a non-INTERNAL status and
				// forwards metadata for. The message is kept verbatim: clients and tests match on it.
				throw new RpcError(errMessage, statusName, traceMeta);
			}
		});
	};
}
