import { afterEach, describe, expect, test, vi } from "vitest";
import { Logger } from "../../utils/logger.js";

describe("Logger", () => {
	afterEach(() => vi.restoreAllMocks());

	test("schreibt Logs ausschließlich nach stderr", () => {
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		const logger = new Logger("debug");

		logger.info("Server gestartet", { transport: "stdio" });

		expect(stderr).toHaveBeenCalledOnce();
		expect(stderr.mock.calls[0][0]).toContain("Server gestartet");
		expect(stdout).not.toHaveBeenCalled();
	});

	test("filtert Meldungen unterhalb des konfigurierten Levels", () => {
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const logger = new Logger("warn");

		logger.info("unsichtbar");
		logger.warn("sichtbar");

		expect(stderr).toHaveBeenCalledOnce();
		expect(stderr.mock.calls[0][0]).toContain("sichtbar");
	});

	test("serialisiert Error-Metadaten mit Name, Nachricht und Stack", () => {
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const logger = new Logger("error");

		logger.error("API fehlgeschlagen", { error: new Error("kaputt") });

		const output = String(stderr.mock.calls[0][0]);
		expect(output).toContain('"name":"Error"');
		expect(output).toContain('"message":"kaputt"');
		expect(output).toContain('"stack"');
	});
});
