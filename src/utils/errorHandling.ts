export class AppError extends Error {
	constructor(
		public message: string,
		public code = "INTERNAL_ERROR",
		public statusCode = 500,
		public details?: Record<string, unknown>,
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

export class ApiError extends AppError {
	constructor(
		message: string,
		code = "API_ERROR",
		statusCode = 500,
		details?: Record<string, unknown>,
	) {
		super(message, code, statusCode, details);
	}
}

export class AuthenticationError extends AppError {
	constructor(message: string) {
		super(message, "AUTHENTICATION_ERROR", 401);
	}
}
export class ResourceNotFoundError extends AppError {
	constructor(message: string) {
		super(message, "RESOURCE_NOT_FOUND", 404);
	}
}
