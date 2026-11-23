#!/usr/bin/env node
// Strenge anti-slop-Stufe für die Dateien, die ein Branch gegenüber seiner
// Basis ändert.
//
//   npm run lint:changed -- [--base <ref>] [-- <oxlint-Optionen>]
//   npm run lint:changed -- --write-config   (nur die Konfiguration erzeugen)
//
// Basis: --base, sonst $BASE_SHA (CI), sonst origin/master oder master.
// Verglichen wird ab dem gemeinsamen Vorfahren mit dem Arbeitsbaum; ungestagte
// Änderungen zählen also mit.
//
// Warum ein Skript: `extends` in oxlint übernimmt ignorePatterns, env und
// globals nicht, und `-D` wirkt nicht auf Regeln aus JS-Plugins. Darum wird die
// aufgelöste Basis-Konfiguration um .oxlintrc.changed.json ergänzt und als
// git-ignorierte Datei im Repo-Root abgelegt, damit relative Pfade stimmen.
//
// Ändert der Branch die Lint-Konfiguration oder das Plugin selbst, entfällt die
// strenge Stufe. Das repoweite Basis-Gate (`npm run lint`) läuft trotzdem.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const oxlint = resolve(root, "node_modules/.bin/oxlint");
const generated = resolve(root, ".oxlintrc.changed.generated.json");

function writeStrictConfig() {
	const resolved = JSON.parse(
		execFileSync(oxlint, ["--print-config"], { cwd: root, encoding: "utf8" })
	);

	// JSONC: nur ganze Kommentarzeilen, die Datei enthält keine anderen.
	const strict = JSON.parse(
		readFileSync(resolve(root, ".oxlintrc.changed.json"), "utf8").replace(/^\s*\/\/.*$/gm, "")
	);

	resolved.rules = { ...resolved.rules, ...strict.rules };
	writeFileSync(generated, `${JSON.stringify(resolved, null, "\t")}\n`);
}

const args = process.argv.slice(2);
const separator = args.indexOf("--");
const ownArgs = separator === -1 ? args : args.slice(0, separator);
const oxlintArgs = separator === -1 ? [] : args.slice(separator + 1);

if (ownArgs.includes("--write-config")) {
	writeStrictConfig();
	console.log(generated);
	process.exit(0);
}

const baseFlag = ownArgs.indexOf("--base");

function refExists(ref) {
	return (
		spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: root })
			.status === 0
	);
}

const base =
	baseFlag !== -1
		? ownArgs[baseFlag + 1]
		: process.env.BASE_SHA || ["origin/master", "master"].find(refExists);

if (!base) {
	console.error("Strenge Stufe: keine Basis gefunden (origin/master, master). --base angeben.");
	process.exit(1);
}

const mergeBase = execFileSync("git", ["merge-base", base, "HEAD"], {
	cwd: root,
	encoding: "utf8",
}).trim();

// core.quotePath=false: Pfade mit Umlauten stehen sonst in Anführungszeichen mit
// Oktal-Escapes, und oxlint überginge sie wegen --no-error-on-unmatched-pattern.
const changed = execFileSync(
	"git",
	["-c", "core.quotePath=false", "diff", "--name-only", "--diff-filter=ACMR", mergeBase],
	{
		cwd: root,
		encoding: "utf8",
	}
)
	.split("\n")
	.filter(Boolean);

const touchesLintSetup = changed.find(
	(file) => file.startsWith(".oxlintrc") || file.startsWith("tools/oxlint/")
);

if (touchesLintSetup) {
	console.log(
		`Strenge Stufe übersprungen: ${touchesLintSetup} ändert die Lint-Einrichtung. Das Basis-Gate (npm run lint) gilt weiter.`
	);
	process.exit(0);
}

const lintable = changed.filter((file) => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file));

if (lintable.length === 0) {
	console.log(`Strenge Stufe: keine geänderten JS/TS-Dateien gegenüber ${base}.`);
	process.exit(0);
}

writeStrictConfig();

const result = spawnSync(
	oxlint,
	["-c", generated, "--quiet", "--no-error-on-unmatched-pattern", ...oxlintArgs, ...lintable],
	{ cwd: root, stdio: "inherit" }
);

process.exit(result.status ?? 1);
