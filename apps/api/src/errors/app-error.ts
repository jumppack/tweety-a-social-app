import { status } from "@grpc/grpc-js";

/**
 * Base Application Error class for domain errors mapped to gRPC Status codes.
 */
export class AppError extends Error {
	constructor(
		message: string,
		public grpcStatus: status = status.INTERNAL,
		public isOperational = true,
	) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

export class ValidationError extends AppError {
	constructor(message: string) {
		super(message, status.INVALID_ARGUMENT);
	}
}

export class UnauthenticatedError extends AppError {
	constructor(message = "Authentication required") {
		super(message, status.UNAUTHENTICATED);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "Permission denied") {
		super(message, status.PERMISSION_DENIED);
	}
}

export class NotFoundError extends AppError {
	constructor(message: string) {
		super(message, status.NOT_FOUND);
	}
}

export class ConflictError extends AppError {
	constructor(message: string) {
		super(message, status.ALREADY_EXISTS);
	}
}

export class BannedAccountError extends AppError {
	constructor(reason?: string | null) {
		super(`Account banned: ${reason || "No reason provided"}`, status.FAILED_PRECONDITION);
	}
}

/** The request is valid but the resource is not in a state that allows it (e.g. edit window expired). */
export class FailedPreconditionError extends AppError {
	constructor(message: string) {
		super(message, status.FAILED_PRECONDITION);
	}
}
