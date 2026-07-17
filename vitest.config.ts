import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/tests/**/*.test.ts"],
		exclude: ["node_modules/", "dist/**", "vitest.config.ts", "**/types.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary", "html"],
			thresholds: {
				lines: 85,
				functions: 85,
				branches: 80,
				statements: 85,
			},
			exclude: [
				"node_modules/",
				"src/tests/**",
				"dist/**",
				"vitest.config.ts",
				"**/types.ts",
			],
		},
	},
});
