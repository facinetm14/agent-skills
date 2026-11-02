#!/usr/bin/env node
/**
 * Bump the app version (expo.version in app.json) — never the build number,
 * which EAS manages remotely (appVersionSource: "remote" + autoIncrement).
 *
 * Usage:
 *   node bump-version.mjs <patch|minor|major|X.Y.Z> [--cwd <dir>] [--dry-run]
 *
 * Each part goes from 0 to 9: a patch after X.Y.9 is X.(Y+1).0, and a minor
 * after X.9.Z is (X+1).0.0. No number is skipped.
 *
 * Also updates package.json "version" when it was equal to the old app version.
 * Prints JSON: { "from": "1.2.3", "to": "1.3.0", "files": [...] }.
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
let cwd = process.cwd();
let dryRun = false;
let kind;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--cwd') cwd = path.resolve(argv[++i] ?? '.');
  else if (argv[i] === '--dry-run') dryRun = true;
  else if (!kind) kind = argv[i];
  else fail(`Unexpected argument: ${argv[i]}`);
}
if (!kind) fail('Usage: node bump-version.mjs <patch|minor|major|X.Y.Z> [--cwd dir] [--dry-run]');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function readJsonFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const indent = raw.match(/^[ \t]+(?=")/m)?.[0] ?? '  ';
  return { data: JSON.parse(raw), indent, trailingNewline: raw.endsWith('\n') };
}

function writeJsonFile(file, { data, indent, trailingNewline }) {
  fs.writeFileSync(file, JSON.stringify(data, null, indent) + (trailingNewline ? '\n' : ''));
}

const appJsonPath = path.join(cwd, 'app.json');
if (!fs.existsSync(appJsonPath)) {
  const dyn = ['app.config.ts', 'app.config.js'].find((f) => fs.existsSync(path.join(cwd, f)));
  fail(dyn
    ? `No app.json: keep "expo.version" in app.json and let ${dyn} read it via config.version, then rerun.`
    : 'No app.json found.');
}

const appJson = readJsonFile(appJsonPath);
const expo = appJson.data.expo ?? appJson.data;
const from = expo.version;
if (!/^\d+\.\d+\.\d+$/.test(String(from ?? ''))) fail(`app.json has no X.Y.Z version (found "${from}").`);

let to;
if (/^\d+\.\d+\.\d+$/.test(kind)) {
  to = kind;
} else {
  const [maj, min, pat] = from.split('.').map(Number);
  if (kind === 'major') to = `${maj + 1}.0.0`;
  else if (kind === 'minor') to = min < 9 ? `${maj}.${min + 1}.0` : `${maj + 1}.0.0`;
  else if (kind === 'patch') to = pat < 9 ? `${maj}.${min}.${pat + 1}` : min < 9 ? `${maj}.${min + 1}.0` : `${maj + 1}.0.0`;
  else fail(`Unknown bump "${kind}" (use patch, minor, major or X.Y.Z).`);
}

const cmp = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};
if (cmp(to, from) <= 0) fail(`New version ${to} must be greater than ${from}.`);

const files = ['app.json'];
expo.version = to;
if (!dryRun) writeJsonFile(appJsonPath, appJson);

const pkgPath = path.join(cwd, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = readJsonFile(pkgPath);
  if (pkg.data.version === from) {
    pkg.data.version = to;
    files.push('package.json');
    if (!dryRun) writeJsonFile(pkgPath, pkg);
  }
}

console.log(JSON.stringify({ from, to, files, dryRun }, null, 2));
