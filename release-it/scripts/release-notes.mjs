#!/usr/bin/env node
/**
 * Build release notes from git history.
 *
 * Usage:
 *   node release-notes.mjs [--from <tag|ref>] [--tag-prefix <prefix>] [--to <ref>] [--max <chars>] [--cwd <dir>] [--json]
 *
 * Defaults: --from = latest tag matching <tag-prefix>* (tag-prefix: v), --to = HEAD, --max = 500 (Google Play limit).
 * Understands Conventional Commits (feat:, fix:, perf:, ...). Non-conventional
 * subjects are kept as "Other changes".
 *
 * Output (markdown, or JSON with --json):
 *   - full changelog grouped by type (for the team / git tag message)
 *   - short user-facing notes, at most --max characters (for Play / TestFlight / testers)
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const argv = process.argv.slice(2);
const opts = { to: 'HEAD', max: 500, cwd: process.cwd(), json: false, tagPrefix: 'v' };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--from') opts.from = argv[++i];
  else if (a === '--tag-prefix') opts.tagPrefix = argv[++i];
  else if (a === '--to') opts.to = argv[++i];
  else if (a === '--max') opts.max = Number(argv[++i]);
  else if (a === '--cwd') opts.cwd = path.resolve(argv[++i]);
  else if (a === '--json') opts.json = true;
  else { console.error(`Unknown option: ${a}`); process.exit(2); }
}

const git = (...args) => {
  const r = spawnSync('git', args, { cwd: opts.cwd, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};

if (git('rev-parse', '--is-inside-work-tree').out !== 'true') {
  console.error('Not a git repository.');
  process.exit(1);
}

if (!opts.from) {
  const d = git('describe', '--tags', '--abbrev=0', '--match', `${opts.tagPrefix}*`, opts.to);
  opts.from = d.code === 0 ? d.out : null;
}

const range = opts.from ? `${opts.from}..${opts.to}` : opts.to;
const log = git('log', range, '--no-merges', '--pretty=format:%h%x1f%s');
if (log.code !== 0) {
  console.error(log.err || 'git log failed');
  process.exit(1);
}

const GROUPS = {
  feat: 'New features',
  fix: 'Bug fixes',
  perf: 'Performance',
  other: 'Other changes',
  internal: 'Internal',
};
const USER_FACING = new Set(['feat', 'fix', 'perf', 'other']);
const INTERNAL_TYPES = new Set(['chore', 'ci', 'build', 'docs', 'test', 'tests', 'refactor', 'style', 'revert']);

const grouped = Object.fromEntries(Object.keys(GROUPS).map((k) => [k, []]));
const re = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/;

for (const line of log.out.split('\n').filter(Boolean)) {
  const [hash, subject] = line.split('\x1f');
  if (/^chore\(release\)/i.test(subject)) continue;
  const m = subject.match(re);
  let type = 'other';
  let text = subject;
  if (m) {
    const t = m[1].toLowerCase();
    text = m[4];
    type = t === 'feat' || t === 'feature' ? 'feat' : t === 'fix' || t === 'bugfix' ? 'fix' : t === 'perf' ? 'perf' : INTERNAL_TYPES.has(t) ? 'internal' : 'other';
    if (m[3]) text = `${text} (breaking)`;
  }
  text = text.charAt(0).toUpperCase() + text.slice(1);
  grouped[type].push({ hash, text });
}

// Full changelog
let full = `## Changes ${opts.from ? `since ${opts.from}` : '(all history)'}\n`;
let any = false;
for (const [k, title] of Object.entries(GROUPS)) {
  if (!grouped[k].length) continue;
  any = true;
  full += `\n### ${title}\n` + grouped[k].map((c) => `- ${c.text} (${c.hash})`).join('\n') + '\n';
}
if (!any) full += '\n_No commits in range._\n';

// Short user-facing notes, bounded by --max characters.
const items = ['feat', 'fix', 'perf', 'other'].filter((k) => USER_FACING.has(k)).flatMap((k) => grouped[k].map((c) => `• ${c.text}`));
let short = '';
let dropped = 0;
for (const item of items) {
  const candidate = short ? `${short}\n${item}` : item;
  if (candidate.length <= opts.max - 25) short = candidate; // keep room for the "+N more" line
  else dropped++;
}
if (dropped) short += `\n• +${dropped} other improvement(s)`;
if (!short) short = '• Bug fixes and improvements';
if (short.length > opts.max) short = short.slice(0, opts.max - 1) + '…';

const result = {
  from: opts.from,
  to: opts.to,
  counts: Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.length])),
  full,
  short,
  shortLength: short.length,
};

if (opts.json) console.log(JSON.stringify(result, null, 2));
else console.log(`${full}\n## Short notes (${short.length}/${opts.max} chars)\n\n${short}\n`);
