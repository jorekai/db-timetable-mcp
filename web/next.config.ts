import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Der Repo-Root hat ein eigenes package-lock.json. Ohne expliziten Root zieht
// Next den Workspace-Root eine Ebene höher und warnt über mehrere Lockfiles.
const nextConfig: NextConfig = {
	turbopack: {
		root: path.dirname(fileURLToPath(import.meta.url)),
	},
};

export default nextConfig;
