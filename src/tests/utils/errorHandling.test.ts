import { describe, expect, test } from "vitest";
import {
	ApiError,
	AppError,
	AuthenticationError,
	ResourceNotFoundError,
} from "../../utils/errorHandling.js";

describe("fachliche Fehler", () => {
	test("AppError bewahrt Code, Status und Details", () => {
		const error = new AppError("Testfehler", "TEST_CODE", 400, {
			field: "evaNo",
		});

		expect(error).toMatchObject({
			name: "AppError",
			message: "Testfehler",
			code: "TEST_CODE",
			statusCode: 400,
			details: { field: "evaNo" },
		});
	});

	test("ApiError nutzt stabile Standardwerte", () => {
		expect(new ApiError("API fehlgeschlagen")).toMatchObject({
			code: "API_ERROR",
			statusCode: 500,
		});
	});

	test("AuthenticationError signalisiert HTTP 401", () => {
		expect(new AuthenticationError("Zugang verweigert")).toMatchObject({
			code: "AUTHENTICATION_ERROR",
			statusCode: 401,
		});
	});

	test("ResourceNotFoundError signalisiert HTTP 404", () => {
		expect(new ResourceNotFoundError("Nicht gefunden")).toMatchObject({
			code: "RESOURCE_NOT_FOUND",
			statusCode: 404,
		});
	});
});
