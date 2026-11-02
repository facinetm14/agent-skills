#!/usr/bin/env node
/**
 * release-it preflight — pre-release checks for an Expo / EAS project.
 *
 * Usage:
 *   node preflight.mjs --platform <android|ios> --mode <beta|production> [options]
 *
 * Options:
 *   --cwd <dir>              Project root (default: current directory)
 *   --release-branch <name>  Branch production releases must come from (default: main, then master)
 *   --skip-quality           Do not run lint / typecheck / test scripts
 *   --skip-doctor            Do not run `npx expo-doctor`
 *   --skip-eas               Do not call EAS CLI (version / whoami)
 *   --tag-prefix <prefix>    Prefix of the app's release tags (default: v), e.g. mobile-v in a monorepo
 *   --no-fetch               Do not `git fetch` before comparing with the remote
 *   --json                   Print the machine-readable report only
 *
 * Exit codes: 0 = no blocking failure, 1 = at least one FAIL, 2 = usage error.
 * Every check has a status: pass | warn | fail | skip, a message and, when useful, a fix.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
const opts = { cwd: process.cwd(), json: false, fetch: true, tagPrefix: 'v' };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => {
    const v = argv[++i];
    if (v === undefined) usage(`Missing value for ${a}`);
    return v;
  };
  switch (a) {
    case '--platform': opts.platform = next().toLowerCase(); break;
    case '--mode': opts.mode = next().toLowerCase(); break;
    case '--cwd': opts.cwd = path.resolve(next()); break;
    case '--release-branch': opts.releaseBranch = next(); break;
    case '--skip-quality': opts.skipQuality = true; break;
    case '--skip-doctor': opts.skipDoctor = true; break;
    case '--skip-eas': opts.skipEas = true; break;
    case '--tag-prefix': opts.tagPrefix = next(); break;
    case '--no-fetch': opts.fetch = false; break;
    case '--json': opts.json = true; break;
    case '-h': case '--help': usage(); break;
    default: usage(`Unknown option: ${a}`);
  }
}
if (opts.platform === 'apple') opts.platform = 'ios';
if (opts.mode === 'prod') opts.mode = 'production';
if (!['android', 'ios'].includes(opts.platform)) usage('--platform must be android or ios');
if (!['beta', 'production'].includes(opts.mode)) usage('--mode must be beta or production');

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error('Usage: node preflight.mjs --platform <android|ios> --mode <beta|production> [--cwd dir] [--json] [--skip-quality] [--skip-doctor] [--skip-eas] [--no-fetch] [--release-branch name] [--tag-prefix v]');
  process.exit(msg ? 2 : 0);
}

// ---------------------------------------------------------------- helpers
const IS_WIN = process.platform === 'win32';
const PROD = opts.mode === 'production';
const ANDROID = opts.platform === 'android';
const results = [];
const facts = { platform: opts.platform, mode: opts.mode, cwd: opts.cwd };

function add(id, status, message, fix) {
  results.push({ id, status, message, ...(fix ? { fix } : {}) });
}

function run(cmd, args, { env = {}, timeoutMs = 120_000 } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: IS_WIN,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    code: r.status ?? (r.error ? -1 : 0),
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    timedOut: r.error?.code === 'ETIMEDOUT',
    error: r.error,
  };
}

function tail(text, lines = 25) {
  return text.trim().split('\n').slice(-lines).join('\n');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(opts.cwd, file), 'utf8'));
  } catch {
    return undefined;
  }
}

function exists(file) {
  return fs.existsSync(path.join(opts.cwd, file));
}

function parseJsonFromOutput(out) {
  const start = out.indexOf('{');
  const end = out.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(out.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

// A real App Store Connect app id is numeric (e.g. "6478123456").
function isPlaceholder(v) {
  return !/^\d{6,}$/.test(String(v ?? '').trim());
}

// ---------------------------------------------------------------- 1. Expo project
const pkg = readJson('package.json');
const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
const appConfigFile = ['app.config.ts', 'app.config.js', 'app.config.mjs', 'app.config.cjs', 'app.json'].find(exists);

if (!pkg) {
  add('expo_project', 'fail', 'No readable package.json in the project root.', `Run the skill from the project root or pass --cwd.`);
} else if (!deps.expo) {
  add('expo_project', 'fail', '`expo` is not a dependency: this does not look like an Expo project.');
} else if (!appConfigFile) {
  add('expo_project', 'fail', 'No app.json / app.config.* found.');
} else {
  add('expo_project', 'pass', `Expo ${deps.expo}, config in ${appConfigFile}.`);
}
facts.expoVersion = deps.expo;

// ---------------------------------------------------------------- 2. Package manager
const lockfiles = [
  ['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'], ['package-lock.json', 'npm'],
];
const pm = lockfiles.find(([f]) => exists(f))?.[1];
facts.packageManager = pm ?? 'npm';
if (pm) add('package_manager', 'pass', `Using ${pm}.`);
else add('package_manager', 'warn', 'No lockfile found, defaulting to npm.', 'Commit a lockfile so EAS installs the same versions as you.');

if (pkg && !exists('node_modules')) {
  add('dependencies_installed', 'fail', 'node_modules is missing.', `Run \`${facts.packageManager} install\`.`);
}

// ---------------------------------------------------------------- 3. EAS CLI and session
if (opts.skipEas) {
  add('eas_cli', 'skip', 'EAS CLI checks skipped (--skip-eas).');
} else {
  const v = run('npx', ['--yes', 'eas-cli@latest', '--version'], { timeoutMs: 180_000 });
  if (v.code !== 0) {
    add('eas_cli', 'fail', `EAS CLI is not runnable: ${tail(v.stderr || v.stdout, 5)}`, 'Check network access and Node installation, then `npm i -g eas-cli`.');
  } else {
    facts.easCliVersion = v.stdout.trim().split('\n').pop();
    add('eas_cli', 'pass', `EAS CLI ${facts.easCliVersion}.`);
    const w = run('npx', ['--yes', 'eas-cli@latest', 'whoami'], { timeoutMs: 60_000 });
    if (w.code === 0) {
      facts.easAccount = w.stdout.trim().split('\n')[0];
      add('eas_auth', 'pass', `Logged in to EAS as ${facts.easAccount}.`);
    } else if (process.env.EXPO_TOKEN) {
      add('eas_auth', 'warn', 'EXPO_TOKEN is set but `eas whoami` failed.', 'Check that the token is valid and not expired.');
    } else {
      add('eas_auth', 'fail', 'Not logged in to EAS.', 'Run `eas login` (or set EXPO_TOKEN in CI).');
    }
  }
}

// ---------------------------------------------------------------- 4. Resolved Expo config
function expoConfig(variant) {
  const r = run('npx', ['expo', 'config', '--json', '--type', 'public'], {
    env: { APP_VARIANT: variant, EXPO_NO_TELEMETRY: '1' },
    timeoutMs: 120_000,
  });
  if (r.code !== 0) return { error: tail(r.stderr || r.stdout, 8) };
  const cfg = parseJsonFromOutput(r.stdout);
  return cfg ? { cfg } : { error: 'Could not parse `expo config --json` output.' };
}

const prodCfgRes = expoConfig('production');
const prodCfg = prodCfgRes.cfg;
if (!prodCfg) {
  add('expo_config', 'fail', `\`npx expo config\` failed: ${prodCfgRes.error}`, `Install dependencies (\`${facts.packageManager} install\`) and fix the app config.`);
} else {
  facts.version = prodCfg.version;
  facts.appName = prodCfg.name;
  facts.androidPackage = prodCfg.android?.package;
  facts.iosBundleIdentifier = prodCfg.ios?.bundleIdentifier;
  facts.projectId = prodCfg.extra?.eas?.projectId;
  facts.runtimeVersion = prodCfg.runtimeVersion;
  add('expo_config', 'pass', `"${prodCfg.name}" version ${prodCfg.version}.`);

  if (!facts.projectId) {
    add('eas_project', 'fail', 'extra.eas.projectId is missing: the project is not linked to EAS.', 'Run `eas init`; with a dynamic app.config, add the printed projectId to app.json under expo.extra.eas.projectId.');
  } else {
    add('eas_project', 'pass', `EAS project ${facts.projectId}.`);
  }

  if (!/^\d+\.\d+\.\d+$/.test(String(prodCfg.version ?? ''))) {
    add('version_format', 'fail', `version "${prodCfg.version}" is not X.Y.Z.`, 'Set a semantic version in app.json (expo.version).');
  }

  if (ANDROID && !facts.androidPackage) {
    add('android_package', 'fail', 'android.package is not set.', 'Set it in app.config (it becomes permanent after the first Play upload).');
  }
  if (!ANDROID && !facts.iosBundleIdentifier) {
    add('ios_bundle_id', 'fail', 'ios.bundleIdentifier is not set.', 'Set it in app.config.');
  }

  // Preview APK must not share the production application id.
  if (ANDROID && !PROD) {
    const prev = expoConfig('preview').cfg;
    facts.previewAndroidPackage = prev?.android?.package;
    if (!prev) {
      add('preview_variant', 'fail', 'Could not resolve the app config with APP_VARIANT=preview.');
    } else if (!prev.android?.package || prev.android.package === facts.androidPackage) {
      add('preview_variant', 'fail',
        `The preview APK uses the same application id as production (${facts.androidPackage}). It would conflict with the Play Store install.`,
        'Make app.config read process.env.APP_VARIANT and suffix the id for preview (see templates/app.config.ts).');
    } else {
      add('preview_variant', 'pass', `Preview APK id ${prev.android.package} (production: ${facts.androidPackage}).`);
    }
  }
}

// ---------------------------------------------------------------- 5. OTA readiness
facts.hasExpoUpdates = Boolean(deps['expo-updates']);
const policy = typeof facts.runtimeVersion === 'object' ? facts.runtimeVersion?.policy : undefined;
facts.runtimeVersionPolicy = policy ?? (facts.runtimeVersion ? 'custom' : undefined);
if (!facts.hasExpoUpdates) {
  add('expo_updates', 'warn', 'expo-updates is not installed: no OTA fixes for testers or users.', 'Run `npx expo install expo-updates` then `eas update:configure`.');
} else if (policy !== 'fingerprint') {
  add('expo_updates', 'warn', `runtimeVersion policy is "${facts.runtimeVersionPolicy ?? 'unset'}", not "fingerprint": an OTA update could reach an incompatible binary.`, 'Set runtimeVersion: { policy: "fingerprint" }.');
} else {
  add('expo_updates', 'pass', 'expo-updates installed with fingerprint runtime policy.');
}

// ---------------------------------------------------------------- 6. eas.json
const eas = readJson('eas.json');
const needBuild = [];
const needSubmit = [];
if (ANDROID && !PROD) { needBuild.push('preview'); }
else { needBuild.push('production'); needSubmit.push(PROD ? 'production' : 'beta'); }
// Android beta can also go to the Play closed track (optional).
facts.buildProfiles = needBuild;
facts.submitProfile = needSubmit[0];
facts.optionalPlayClosedTest = ANDROID && !PROD ? { buildProfile: 'production', submitProfile: 'beta' } : undefined;

if (!eas) {
  add('eas_json', 'fail', 'eas.json is missing or invalid JSON.', 'Copy templates/eas.json from the skill folder and adapt it.');
} else {
  const problems = [];
  const warnings = [];
  if (eas.cli?.appVersionSource !== 'remote') warnings.push('cli.appVersionSource is not "remote" (build numbers may collide).');
  for (const p of needBuild) {
    if (!eas.build?.[p]) problems.push(`build profile "${p}" is missing`);
  }
  if (eas.build?.production && !eas.build.production.autoIncrement) warnings.push('build.production.autoIncrement is not enabled.');
  if (ANDROID && !PROD && eas.build?.preview) {
    const pv = eas.build.preview;
    if (pv.distribution !== 'internal') problems.push('build.preview.distribution must be "internal"');
    if (pv.android?.buildType !== 'apk') problems.push('build.preview.android.buildType must be "apk"');
    if (pv.env?.APP_VARIANT !== 'preview') warnings.push('build.preview.env.APP_VARIANT is not "preview".');
  }
  for (const s of needSubmit) {
    const prof = eas.submit?.[s]?.[opts.platform];
    if (!prof) { problems.push(`submit profile "${s}.${opts.platform}" is missing`); continue; }
    if (ANDROID) {
      const expectedTrack = s === 'production' ? 'production' : 'alpha';
      if (prof.track && prof.track !== expectedTrack) warnings.push(`submit.${s}.android.track is "${prof.track}" (expected "${expectedTrack}" unless you use a custom track).`);
      if (s === 'production' && prof.releaseStatus === 'completed') warnings.push('submit.production.android.releaseStatus is "completed": no staged rollout.');
    } else if (isPlaceholder(prof.ascAppId)) {
      problems.push(`submit.${s}.ios.ascAppId is missing or a placeholder`);
    }
  }
  if (problems.length) add('eas_json', 'fail', problems.join('; ') + '.', 'Align eas.json with templates/eas.json.');
  else add('eas_json', warnings.length ? 'warn' : 'pass', warnings.length ? warnings.join(' ') : 'Required build/submit profiles present.');
}

// ---------------------------------------------------------------- 7. Git state
const inRepo = run('git', ['rev-parse', '--is-inside-work-tree']).stdout.trim() === 'true';
if (!inRepo) {
  add('git', PROD ? 'fail' : 'warn', 'Not a git repository: no tags or release history.', 'Run `git init` and commit the project.');
} else {
  if (opts.fetch) run('git', ['fetch', '--quiet', '--tags'], { timeoutMs: 60_000 });
  const dirty = run('git', ['status', '--porcelain']).stdout.trim();
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  facts.branch = branch;
  if (dirty) {
    const n = dirty.split('\n').length;
    add('git_clean', PROD ? 'fail' : 'warn', `${n} uncommitted change(s).`, 'Commit or stash before releasing.');
  } else {
    add('git_clean', 'pass', 'Working tree clean.');
  }
  if (PROD) {
    const branches = run('git', ['branch', '--list', '--format=%(refname:short)']).stdout.split('\n').map((s) => s.trim());
    const releaseBranch = opts.releaseBranch ?? (branches.includes('main') ? 'main' : branches.includes('master') ? 'master' : 'main');
    facts.releaseBranch = releaseBranch;
    if (branch !== releaseBranch) add('git_branch', 'warn', `On "${branch}", not "${releaseBranch}".`, `Confirm with the user or switch to ${releaseBranch}.`);
    else add('git_branch', 'pass', `On ${releaseBranch}.`);
  }
  const ab = run('git', ['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
  if (ab.code !== 0) {
    add('git_remote', PROD ? 'warn' : 'skip', 'No upstream branch configured.');
  } else {
    const [ahead, behind] = ab.stdout.trim().split(/\s+/).map(Number);
    if (behind > 0) add('git_remote', PROD ? 'fail' : 'warn', `${behind} commit(s) behind the remote.`, 'Pull before releasing.');
    else if (ahead > 0) add('git_remote', 'warn', `${ahead} local commit(s) not pushed.`, 'Push before or right after the release.');
    else add('git_remote', 'pass', 'In sync with the remote.');
  }

  // Secrets that must never be tracked.
  const tracked = run('git', ['ls-files']).stdout.split('\n');
  const secretRe = /\.(jks|keystore|p8|p12|mobileprovision)$|(^|\/)credentials\.json$|service[-_]?account.*\.json$|play.*key.*\.json$|api[-_]?key.*\.json$/i;
  const leaked = tracked.filter((f) => secretRe.test(f));
  if (leaked.length) add('secrets', 'fail', `Secret-looking files are tracked by git: ${leaked.join(', ')}.`, 'Remove them from git (`git rm --cached`), add them to .gitignore, and rotate the keys.');
  else add('secrets', 'pass', 'No keystore / key file tracked by git.');
}

// ---------------------------------------------------------------- 8. Version and tags
if (inRepo && facts.version) {
  const P = opts.tagPrefix;
  const tags = run('git', ['tag', '--list', `${P}*`]).stdout.split('\n').map((t) => t.trim()).filter(Boolean);
  const last = run('git', ['describe', '--tags', '--abbrev=0', '--match', `${P}*`]);
  facts.lastTag = last.code === 0 ? last.stdout.trim() : null;
  const v = facts.version;
  if (PROD) {
    facts.nextTag = `${P}${v}`;
    if (tags.includes(`${P}${v}`)) {
      add('version_tag', 'fail', `${P}${v} is already released.`, 'Bump the version: node scripts/bump-version.mjs <patch|minor|major>.');
    } else {
      add('version_tag', 'pass', `Will tag ${P}${v}.`);
    }
  } else {
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${esc(P)}${esc(v)}-beta\\.(\\d+)$`);
    const n = tags.map((t) => t.match(re)?.[1]).filter(Boolean).map(Number);
    facts.nextTag = `${P}${v}-beta.${n.length ? Math.max(...n) + 1 : 1}`;
    if (tags.includes(`${P}${v}`)) add('version_tag', 'warn', `${P}${v} is already released in production; this beta reuses its version.`, 'Consider bumping the version first.');
    else add('version_tag', 'pass', `Will tag ${facts.nextTag}.`);
  }
}

// ---------------------------------------------------------------- 9. Store credentials (best effort)
if (eas) {
  if (ANDROID) {
    const profileName = PROD ? 'production' : 'beta';
    const keyPath = eas.submit?.[profileName]?.android?.serviceAccountKeyPath;
    if (keyPath) {
      const abs = path.resolve(opts.cwd, keyPath);
      if (!fs.existsSync(abs)) {
        facts.playConfigured = 'no';
        add('play_credentials', PROD ? 'fail' : 'warn', `serviceAccountKeyPath "${keyPath}" does not exist.`, 'Download the Google service account JSON key or upload it to EAS credentials instead.');
      } else {
        const ignored = inRepo && run('git', ['check-ignore', '-q', keyPath]).code === 0;
        facts.playConfigured = 'yes';
        add('play_credentials', ignored || !inRepo ? 'pass' : 'fail', ignored || !inRepo ? `Service account key found (${keyPath}).` : `${keyPath} is not git-ignored.`, ignored || !inRepo ? undefined : 'Add it to .gitignore.');
      }
    } else {
      facts.playConfigured = 'unknown';
      add('play_credentials', PROD ? 'warn' : 'skip', 'No serviceAccountKeyPath in eas.json: the key may be stored in EAS credentials, or Google Play is not set up yet.', 'Ask the user whether the app exists in Play Console and a service account key is uploaded to EAS (`eas credentials -p android`).');
    }
  }
}

// ---------------------------------------------------------------- 10. Quality scripts
const scripts = pkg?.scripts ?? {};
const runScriptCmd = (name) => {
  switch (facts.packageManager) {
    case 'yarn': return ['yarn', [name]];
    case 'pnpm': return ['pnpm', ['run', name]];
    case 'bun': return ['bun', ['run', name]];
    default: return ['npm', ['run', name]];
  }
};
const quality = [];
if (scripts.lint) quality.push(['lint', ...runScriptCmd('lint')]);
const tc = ['typecheck', 'type-check', 'tsc', 'types'].find((s) => scripts[s]);
if (tc) quality.push(['typecheck', ...runScriptCmd(tc)]);
else if (exists('tsconfig.json')) quality.push(['typecheck', 'npx', ['tsc', '--noEmit']]);
if (scripts.test && !/no test specified/.test(scripts.test)) quality.push(['test', ...runScriptCmd('test')]);
facts.qualityChecks = quality.map(([id]) => id);

if (opts.skipQuality) {
  add('quality', 'skip', 'Quality checks skipped (--skip-quality).');
} else if (!quality.length) {
  add('quality', 'warn', 'No lint / typecheck / test script found.', 'Add at least a typecheck and a test script.');
} else {
  for (const [id, cmd, args] of quality) {
    const r = run(cmd, args, { env: { CI: 'true' }, timeoutMs: 15 * 60_000 });
    if (r.code === 0) add(`quality_${id}`, 'pass', `${id} passed.`);
    else add(`quality_${id}`, 'fail', `${id} failed${r.timedOut ? ' (timeout)' : ''}:\n${tail(r.stdout + '\n' + r.stderr)}`, 'Fix the errors, then rerun.');
  }
}

// ---------------------------------------------------------------- 11. expo-doctor
if (opts.skipDoctor) {
  add('expo_doctor', 'skip', 'expo-doctor skipped (--skip-doctor).');
} else if (pkg?.dependencies?.expo || deps.expo) {
  const r = run('npx', ['--yes', 'expo-doctor@latest'], { timeoutMs: 5 * 60_000 });
  if (r.code === 0) add('expo_doctor', 'pass', 'expo-doctor: no issues.');
  else add('expo_doctor', 'fail', `expo-doctor reported issues:\n${tail(r.stdout + '\n' + r.stderr, 30)}`, 'Apply the suggested fixes (often `npx expo install --check`).');
}

// ---------------------------------------------------------------- report
const counts = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
const ok = !counts.fail;
const report = { ok, counts, facts, results };

if (opts.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const icon = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', skip: 'SKIP' };
  console.log(`release-it preflight — ${opts.platform} / ${opts.mode}\n`);
  for (const r of results) {
    console.log(`[${icon[r.status]}] ${r.id}: ${r.message}`);
    if (r.fix && r.status !== 'pass') console.log(`        fix: ${r.fix}`);
  }
  console.log(`\nSummary: ${counts.pass ?? 0} pass, ${counts.warn ?? 0} warn, ${counts.fail ?? 0} fail, ${counts.skip ?? 0} skip`);
  console.log('\nFacts:');
  console.log(JSON.stringify(facts, null, 2));
  console.log(ok ? '\nNo blocking failure.' : '\nBLOCKED: fix the FAIL items before releasing.');
}
process.exit(ok ? 0 : 1);
