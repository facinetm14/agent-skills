---
name: release-it
description: Release an Expo / React Native app with EAS. `/release-it android beta` builds a tester APK shared by link (plus the Play closed test once Play is set up); `/release-it android` ships to Google Play production with a 5% staged rollout; `/release-it ios beta` ships to TestFlight; `/release-it ios` uploads an App Store build. Runs blocking preflight checks and asks for confirmation before anything is built or submitted.
argument-hint: <android|ios> [beta]
disable-model-invocation: true
---

# release-it

Ship an Expo app with EAS Build, EAS Submit and EAS Update, behind blocking checks.

Arguments received: `$ARGUMENTS`

## Files in this skill

Resolve the skill directory first (the folder containing this SKILL.md, usually `.claude/skills/release-it/` in the project or `~/.claude/skills/release-it/`). Call it `SKILL_DIR` below.

| Path | Purpose |
|---|---|
| `scripts/preflight.mjs` | All pre-release checks, prints PASS/WARN/FAIL/SKIP and project facts (version, next tag, ids, profiles). Exit 1 on any FAIL. |
| `scripts/bump-version.mjs` | Bumps `expo.version` in app.json (+ package.json if in sync). Never touches build numbers. |
| `scripts/release-notes.mjs` | Changelog since the last `v*` tag + short user-facing notes (≤ 500 chars). |
| `templates/eas.json` | Reference EAS config (development / preview / production builds, beta / production submits). |
| `templates/app.config.ts` | Reference multi-variant app config driven by `APP_VARIANT`. |
| `templates/tester-message.md` | Message to send APK testers (FR + EN). |

**Tag prefix.** In this project the `v*` tags belong to the API and the web app (they deploy them); the mobile app has its own numbering, `expo.version` in `mobile/app.json`, tagged `mobile-v<version>` (`mobile-v1.0.0-beta.3`, `mobile-v1.0.0`). Run the scripts from `mobile/` and always pass `--tag-prefix mobile-v` to `preflight.mjs` and `release-notes.mjs`. Each part of a version goes from 0 to 9, no number skipped: 1.0.9 is followed by 1.1.0 (`bump-version.mjs` does it).

All scripts are plain Node (no dependencies). Run them from the project root, e.g. `node "$SKILL_DIR/scripts/preflight.mjs" --platform android --mode beta`. Add `--help`-style options only as documented at the top of each script.

## What each command does

| Command | Result |
|---|---|
| `android beta` | **Tester APK** (`preview` profile, internal distribution) shared by link / QR code, installable without the Play Store. Optionally, if Google Play is set up: production AAB → Play **closed testing** track (`alpha`), only after explicit confirmation. |
| `android` | Production AAB → Google Play **production** track, staged rollout 5%. |
| `ios beta` | Production iOS build → App Store Connect → **TestFlight**. |
| `ios` | Production iOS build → App Store Connect, ready to be submitted for App Store review. |

## Step 0 — Parse the arguments

- Case-insensitive, any order: `beta android` = `android beta`.
- Platform: `android` or `ios` (`apple` → ios). Exactly one.
- Mode: `beta`, `bêta`, `test`, `testing`, `apk` → beta. `prod`, `production` or no mode → production.
- No argument, two platforms, or an unknown word: do nothing, show the command table above and ask which command the user wants.
- In production mode, say plainly that this is a production release before going further.

## Step 1 — Preflight

Run:

```bash
node "$SKILL_DIR/scripts/preflight.mjs" --platform <android|ios> --mode <beta|production> --tag-prefix mobile-v --json
```

Read the JSON report (`ok`, `results`, `facts`).

- Any `fail` → stop. Explain each failure and its `fix` in plain words. Offer to apply fixes that are file edits (eas.json, app.config, .gitignore) after showing the diff. Never bypass a failure unless the user explicitly says so for this run; if they do, rerun with the matching `--skip-*` flag and mention it in the final report.
- `warn` → list them briefly; ask before continuing only for git warnings in production.
- Long checks: quality scripts and `expo-doctor` can take minutes. If the user asks for speed, `--skip-doctor` is acceptable in beta mode only; never skip quality checks in production.
- **Missing config files**: if `eas.json` is missing, propose `templates/eas.json`. If the app config does not read `APP_VARIANT` (check `preview_variant`), propose `templates/app.config.ts`, adapting name / slug / id from the current config, keeping `version` in app.json. Ask before writing.
- **Version already released** (`version_tag` fail in production): ask patch / minor / major, run `node "$SKILL_DIR/scripts/bump-version.mjs" <kind>`, commit `chore(release): vX.Y.Z`, rerun preflight.
- **Play status** (`facts.playConfigured`): `unknown` means the service account key may live in EAS credentials. Ask the user whether the app already exists in Play Console with a service account key uploaded to EAS. For `android beta`, Play not set up is fine: APK only.
- **Store submission for iOS** needs a numeric `ascAppId` in eas.json; preflight fails otherwise.

## Step 2 — Choose the path

1. **Existing EAS workflow**: if `.eas/workflows/` holds a workflow matching this release, offer `npx eas-cli workflow:run <file>` so CI and manual releases share one path. If accepted, run it, follow its status, then jump to Step 6.
2. **android beta, JS-only change**: if `facts.hasExpoUpdates` is true and a previous preview APK exists for the same native code, offer an OTA update instead of a new APK:
   ```bash
   make mobile-ota MSG="<summary>"
   ```
   `eas update` does not read the `env` of `eas.json` (only `eas build` does): an update published without `EXPO_PUBLIC_API_URL` calls `http://localhost:8080` and no flow works. `make mobile-ota` passes the env of the `preview` profile; never run `eas update` by hand without it. Testers get it on the next app restart, no reinstall. If you cannot tell whether native code changed, build the APK.
3. **android production, tested binary available**: if a `vX.Y.Z-beta.*` tag exists for the same version and that beta went to the Play closed track, recommend promoting that exact binary in Play Console (Testing › Closed testing › the release › Promote release › Production, rollout 5%) instead of rebuilding. If the user chooses promotion, give the exact steps and jump to Step 6.
4. Production OTA (`eas update --channel production`) is never chosen silently: only when the user asks for a JS hotfix, with every variable of the `env` of the `production` profile of `eas.json` (`EXPO_PUBLIC_API_URL` above all, see 2.) and a staged rollout (`--rollout-percentage 10` if supported by the installed CLI; check `npx eas-cli update --help`).

## Step 3 — Release notes and confirmation

1. Run `node "$SKILL_DIR/scripts/release-notes.mjs" --tag-prefix mobile-v --json` and use `short` for the stores / testers and `full` for the tag message. Rewrite `short` in the users' language if commits are in another language.
2. Show a recap and **wait for explicit confirmation** before any build:
   - platform, mode, build profile(s), destination(s)
   - version and the tag that will be created (`facts.nextTag`)
   - android beta: APK yes; Play closed test yes/no
   - android production: track production, rollout 5%
   - short release notes
   - warnings still open

## Step 4 — Build

Always non-interactive, capturing the JSON output:

```bash
# android beta (tester APK)
npx eas-cli build --platform android --profile preview --non-interactive --wait --json

# production, Play closed test, or iOS
npx eas-cli build --platform <android|ios> --profile production --non-interactive --wait --json
```

- Take `id` and `artifacts.buildUrl` from the JSON (array of builds). The build page (install button + QR code) is `https://expo.dev/accounts/<account>/projects/<slug>/builds/<id>`; prefer the exact URL printed by the CLI when present.
- **First Android build**: if EAS must create the keystore and refuses in non-interactive mode, ask the user to run once in a terminal `eas build -p android --profile <profile>` (or `eas credentials -p android`) and accept the generation. Remind them to download a backup of the keystore into a password manager.
- **iOS credentials missing**: same approach with `eas credentials -p ios`.
- **Failure**: `npx eas-cli build:view <id>`, read the failing phase logs, summarise the cause, propose a fix. Do not retry in a loop: at most one retry after a fix.

## Step 5 — Distribute

**Tester APK**: nothing to submit. Keep the build page URL for the tester message.

**Stores**:

```bash
npx eas-cli submit --platform <android|ios> --profile <beta|production> --id <BUILD_ID> --non-interactive --wait
```

- **First ever Android upload**: the Google Play API rejects the very first upload of an app. If the error says so, give the AAB download link and ask the user to upload it manually in Play Console (internal or closed testing). Later releases go through this skill.
- **versionCode already used**: check `cli.appVersionSource: "remote"` and `autoIncrement`; never resubmit a build already sent.
- **Service account permissions**: it needs access to the app in Play Console (Users and permissions) with release rights on the target tracks.
- If the submit tooling does not carry release notes, give `short` ready to paste in Play Console / App Store Connect.

## Step 6 — After the release

1. Create an annotated tag `facts.nextTag` with `full` as message and push it (`git tag -a <tag> -m ...`, `git push origin <tag>`), unless the user declined in the recap.
2. If a crash-reporting plugin (Sentry or other) is configured, check the build log shows source maps uploaded; otherwise mention it.
3. Short report: build link, destination, status, then:
   - **Tester APK**: fill `templates/tester-message.md` (language of the testers) with app name, version, build page URL and short notes, ready to send.
   - **Play closed test**: testers in the Google Group get it through the opt-in link.
   - **Android production**: rollout at 5%. Watch crash-free sessions and Android Vitals for 24 to 48 h before 20%, 50%, 100%; if something breaks, halt the rollout in Play Console.
   - **iOS beta**: available in TestFlight after Apple processing; internal testers get it directly, external groups after beta review.
   - **iOS production**: in App Store Connect, finish the version page, select the build, enable phased release if wanted, then "Submit for Review".
   - Mention any skipped check or open warning.

## Rules

- Never build or submit without explicit confirmation of the recap.
- Never commit, print in full or log a secret (service account key, `.p8`, keystore, token).
- Never edit `versionCode` / `buildNumber` by hand.
- Never send a `preview` build to Google Play; Play only receives `production` builds.
- Never set the first Android production rollout above 5% unless the user explicitly asks.
- Never use `--force`, and never delete builds, releases or tags.
- If an EAS command rejects an option, read `npx eas-cli <command> --help` and adapt instead of guessing.

## Good to know

- Sideloaded APKs: Google is rolling out developer verification for apps installed outside the Play Store (first countries in late 2026, worldwide planned for 2027). If testers suddenly cannot install the APK, the user must verify their developer identity in Play Console or the Android Developer Console.
- The `preview` APK has its own application id (`<id>.preview`) and name suffix "(Beta)", so it installs next to the Play Store version.
