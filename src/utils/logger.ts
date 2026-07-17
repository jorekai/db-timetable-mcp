import { config } from "../config.js";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogMetadata = Record<string, unknown>;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

function serializeMetadata(metadata: LogMetadata): string {
	const seen = new WeakSet<object>();
	return JSON.stringify(metadata, (_key, value: unknown) => {
		if (value instanceof Error) {
			return { name: value.name, message: value.message, stack: value.stack };
		}
		if (value && typeof value === "object") {
			if (seen.has(value)) return "[Circular]";
			seen.add(value);
		}
		return value;
	});
}

export class Logger {
	constructor(private level: LogLevel = "info") {}

	private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
		if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) return;
		const context = metadata ? ` ${serializeMetadata(metadata)}` : "";
		process.stderr.write(
			`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${context}\n`,
		);
	}

	debug(message: string, metadata?: LogMetadata): void {
		this.log("debug", message, metadata);
	}

	info(message: string, metadata?: LogMetadata): void {
		this.log("info", message, metadata);
	}

	warn(message: string, metadata?: LogMetadata): void {
		this.log("warn", message, metadata);
	}

	error(message: string, metadata?: LogMetadata): void {
		this.log("error", message, metadata);
	}
}

export const logger = new Logger(config.logging.level);
