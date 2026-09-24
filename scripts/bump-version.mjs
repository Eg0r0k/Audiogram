// Sets the app version everywhere a release reads it.
// Usage: pnpm bump <x.y.z | patch | minor | major> [--dry-run]
//
// Android takes its versionName/versionCode from tauri.conf.json, and
// docs/manifests/*/latest.json is written by the release workflow once the
// artifacts exist, so neither is touched here.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^\d+\.\d+\.\d+$/;

const targets = [
  {
    file: "package.json",
    pattern: /("version":\s*")([^"]+)(")/,
  },
  {
    file: "src-tauri/tauri.conf.json",
    pattern: /("version":\s*")([^"]+)(")/,
  },
  {
    file: "src-tauri/Cargo.toml",
    pattern: /(\[package\][^[]*?\nversion\s*=\s*")([^"]+)(")/,
  },
  {
    // Only the app's own entry: other crates can share the version string.
    file: "src-tauri/Cargo.lock",
    pattern: /(\nname = "audiogram"\r?\nversion = ")([^"]+)(")/,
  },
];

const fail = (message) => {
  console.error(`bump: ${message}`);
  process.exit(1);
};

const nextVersion = (current, arg) => {
  if (SEMVER.test(arg)) return arg;
  const [major, minor, patch] = current.split(".").map(Number);
  if (arg === "major") return `${major + 1}.0.0`;
  if (arg === "minor") return `${major}.${minor + 1}.0`;
  if (arg === "patch") return `${major}.${minor}.${patch + 1}`;
  return fail(`expected x.y.z, patch, minor or major, got "${arg}"`);
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const [arg] = args.filter(a => a !== "--dry-run");
if (!arg) fail("usage: pnpm bump <x.y.z | patch | minor | major> [--dry-run]");

const files = targets.map((target) => {
  const path = join(root, target.file);
  const text = readFileSync(path, "utf8");
  const global = new RegExp(target.pattern.source, "g");
  const matches = [...text.matchAll(global)];
  if (matches.length !== 1) fail(`${target.file}: expected one version entry, found ${matches.length}`);
  return { ...target, path, text, current: matches[0][2] };
});

const versions = new Set(files.map(f => f.current));
if (versions.size !== 1) {
  const lines = files.map(f => `  ${f.file}: ${f.current}`).join("\n");
  fail(`versions disagree:\n${lines}`);
}

const current = files[0].current;
if (!SEMVER.test(current)) fail(`current version "${current}" is not x.y.z`);
const next = nextVersion(current, arg);
if (next === current) fail(`already at ${current}`);

for (const f of files) {
  console.log(`${f.file}: ${current} -> ${next}`);
  if (!dryRun) writeFileSync(f.path, f.text.replace(f.pattern, `$1${next}$3`));
}
console.log(dryRun ? "dry run, nothing written" : `bumped to ${next}`);
