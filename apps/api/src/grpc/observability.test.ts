import * as grpc from "@grpc/grpc-js";
import { adaptService, createDefinition } from "@protobuf-ts/grpc-backend";
import { RpcError, type ServerCallContext } from "@protobuf-ts/runtime-rpc";
import { AuthService } from "@tweety/proto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../errors/app-error";
import { getTraceId } from "../utils/context";
import { authHandler } from "./handlers/auth.handler";
import { TRACE_ID_METADATA_KEY, withObservability } from "./observability";

function fakeContext(headers: Record<string, string> = {}) {
	return {
		headers,
		trailers: {},
		sendResponseHeaders: vi.fn(),
	} as unknown as ServerCallContext & { sendResponseHeaders: ReturnType<typeof vi.fn> };
}

function captureLogs() {
	const spy = vi.spyOn(console, "log").mockImplementation(() => {});
	return {
		spy,
		entries: () =>
			spy.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>),
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("withObservability", () => {
	it("returns the trace ID in response headers and trailers, and logs it", async () => {
		const logs = captureLogs();
		let traceSeenByService: string | undefined;
		const handler = withObservability("TestService/ok", async () => {
			traceSeenByService = getTraceId();
			return { ok: true };
		});
		const ctx = fakeContext();

		await expect(handler({}, ctx)).resolves.toEqual({ ok: true });

		const sent = ctx.sendResponseHeaders.mock.calls[0][0][TRACE_ID_METADATA_KEY];
		expect(sent).toMatch(/^[0-9a-f-]{36}$/);
		expect(ctx.trailers[TRACE_ID_METADATA_KEY]).toBe(sent);
		expect(traceSeenByService).toBe(sent);
		const [entry] = logs.entries();
		expect(entry).toMatchObject({
			level: "INFO",
			traceId: sent,
			method: "TestService/ok",
			status: "OK",
		});
		expect(typeof entry.durationMs).toBe("number");
	});

	it("reuses a well-formed incoming x-trace-id and ignores a malformed one", async () => {
		captureLogs();
		const handler = withObservability("TestService/ok", async () => getTraceId());

		await expect(handler({}, fakeContext({ "x-trace-id": "upstream-trace-1234" }))).resolves.toBe(
			"upstream-trace-1234",
		);
		const injected = await handler({}, fakeContext({ "x-trace-id": "bad\n{json}" }));
		expect(injected).not.toBe("bad\n{json}");
	});

	it("logs soft errors at WARN without changing the response contract", async () => {
		const logs = captureLogs();
		const response = { success: false, error: "Post not found" };
		const handler = withObservability("TestService/soft", async () => response);

		await expect(handler({}, fakeContext())).resolves.toBe(response);
		expect(logs.entries()[0]).toMatchObject({
			level: "WARN",
			outcome: "soft_error",
			error: "Post not found",
		});
	});

	it("maps AppErrors to their gRPC status and attaches the trace ID to error metadata", async () => {
		const logs = captureLogs();
		const handler = withObservability("TestService/fail", async () => {
			throw new NotFoundError("Post not found");
		});

		const error = await handler({}, fakeContext()).catch((e) => e);

		expect(error).toBeInstanceOf(RpcError);
		expect(error.message).toBe("Post not found");
		expect(error.code).toBe("NOT_FOUND");
		expect(error.meta[TRACE_ID_METADATA_KEY]).toBe(logs.entries()[0].traceId);
		expect(logs.entries()[0]).toMatchObject({ status: "NOT_FOUND", grpcStatusCode: 5 });
	});

	it("maps unknown errors to INTERNAL and logs at ERROR", async () => {
		const logs = captureLogs();
		const handler = withObservability("TestService/crash", async () => {
			throw new Error("boom");
		});

		const error = await handler({}).catch((e) => e);

		expect(error.code).toBe("INTERNAL");
		expect(error.message).toBe("boom");
		expect(logs.entries()[0]).toMatchObject({ level: "ERROR", status: "INTERNAL" });
	});
});

/**
 * End-to-end over a real gRPC socket: proves the trace ID actually reaches a client
 * (the protobuf-ts grpc-backend adapter only forwards metadata / non-INTERNAL codes for RpcError).
 */
describe("trace ID over the wire", () => {
	let server: grpc.Server;
	// biome-ignore lint/suspicious/noExplicitAny: generic grpc-js client built from a runtime definition
	let client: any;

	beforeAll(async () => {
		server = new grpc.Server();
		server.addService(...adaptService(AuthService, authHandler));
		const port = await new Promise<number>((resolve, reject) =>
			server.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (err, p) =>
				err ? reject(err) : resolve(p),
			),
		);
		const Client = grpc.makeGenericClientConstructor(createDefinition(AuthService), "AuthService");
		client = new Client(`127.0.0.1:${port}`, grpc.credentials.createInsecure());
	});

	afterAll(() => {
		client?.close();
		server?.forceShutdown();
	});

	it("returns x-trace-id in the response metadata of a successful call", async () => {
		captureLogs();
		let resolveResponse!: (r: { valid: boolean }) => void;
		let rejectResponse!: (e: Error) => void;
		const responseP = new Promise<{ valid: boolean }>((res, rej) => {
			resolveResponse = res;
			rejectResponse = rej;
		});
		const call = client.validateSession(
			{ sessionToken: "not-a-token" },
			(err: grpc.ServiceError | null, r: { valid: boolean }) =>
				err ? rejectResponse(err) : resolveResponse(r),
		);
		const headersP = new Promise<grpc.Metadata>((res) => call.on("metadata", res));
		const statusP = new Promise<grpc.StatusObject>((res) => call.on("status", res));
		const [response, headers, { metadata: trailers }] = await Promise.all([
			responseP,
			headersP,
			statusP,
		]);

		expect(response.valid).toBe(false);
		const traceId = headers.get(TRACE_ID_METADATA_KEY)[0];
		expect(traceId).toMatch(/^[0-9a-f-]{36}$/);
		expect(trailers.get(TRACE_ID_METADATA_KEY)[0]).toBe(traceId);
	});

	it("returns the proper status code, original message and x-trace-id on a failed call", async () => {
		captureLogs();
		const error = await new Promise<grpc.ServiceError>((resolve) => {
			client.getCurrentUser({ sessionToken: "forged" }, (err: grpc.ServiceError) => resolve(err));
		});

		expect(error.code).toBe(grpc.status.UNAUTHENTICATED);
		expect(error.details).toBe("Invalid or expired session token");
		expect(error.metadata.get(TRACE_ID_METADATA_KEY)[0]).toMatch(/^[0-9a-f-]{36}$/);
	});
});
