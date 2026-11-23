// Richtet die Git-Hooks aus lefthook.yml ein. Läuft über `prepare` bei jeder
// Installation und tut nichts, wo Hooks nichts verloren haben.
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));

function git(...args) {
	const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });

	return result.status === 0 ? result.stdout.trim() : undefined;
}

const toplevel = git("rev-parse", "--show-toplevel");

// Als Git-Abhängigkeit liegt das Paket in node_modules eines fremden
// Repositorys; dessen Hooks gehen dieses Projekt nichts an.
const ownRepository = toplevel !== undefined && realpathSync(toplevel) === root;

if (process.env.CI || !ownRepository || git("config", "--get", "core.hooksPath") === "/dev/null") {
	process.exit(0);
}

const lefthook = resolve(root, "node_modules/lefthook/bin/index.js");

// Fehlt bei `npm ci --omit=dev`.
if (!existsSync(lefthook)) {
	process.exit(0);
}

const install = spawnSync(process.execPath, [lefthook, "install"], { cwd: root, stdio: "inherit" });

// Zum Beispiel bei einer eigenen core.hooksPath. Fehlende Hooks dürfen die
// Installation nicht scheitern lassen; die CI prüft dasselbe.
if (install.status !== 0) {
	console.warn("Git-Hooks nicht eingerichtet (Grund siehe oben). Die Installation läuft weiter.");
}
