# Android (APK) testing playbook

Coverage backbone: **OWASP MASVS** (verification standard) + **MASTG** (test
guide). You're testing the client, but remember the client is attacker-
controlled — anything it "protects" client-side is already compromised. The
real questions are: what secrets ship in the binary, what does it expose to
other apps, and how does it talk to the backend.

## Table of contents
1. Static analysis (unpack & read)
2. Dynamic analysis (run & observe)
3. MASVS category → tests
4. Tool cheatsheet

---

## 1. Static analysis

- **Unpack:** `apktool d app.apk` (resources + smali), `jadx app.apk` (Java-ish
  decompile). Or run the whole thing through **MobSF** for an automated report.
- **Manifest** (`AndroidManifest.xml`) — the highest-value file:
  - `android:debuggable="true"` in a release build → finding.
  - `android:allowBackup="true"` → app data extractable via adb backup.
  - `android:usesCleartextTraffic="true"` or a permissive
    `network_security_config.xml` → MITM exposure.
  - **Exported components** (`exported="true"` or an intent-filter with no
    permission) — activities, services, receivers, **content providers** other
    apps can invoke. Test each: can a malicious app trigger privileged actions
    or read data through it?
  - Over-broad permissions vs what the app needs.
- **Secrets in the binary:** grep decompiled code + resources for API keys,
  tokens, hardcoded creds, backend URLs, cloud bucket names. `strings` on the
  native `.so` libs too. Anything here is public — treat shipped secrets as
  compromised.
- **Endpoints:** collect every URL the app talks to → feed into the web/API
  playbook. The mobile backend is usually where the real bugs are.
- **Certificate pinning:** present or not? Absence = trivial MITM; presence =
  note it (and that it's bypassable on a rooted device, so it's defense-in-depth
  not a guarantee).
- **Insecure storage:** SharedPreferences/SQLite/files written world-readable or
  holding plaintext tokens/PII.

---

## 2. Dynamic analysis (needs an emulator or test device)

- **Traffic interception:** route through Burp/ZAP; install the CA; observe the
  API calls live. If pinning blocks you, bypass with Frida/objection *on your
  own test device* to see the real traffic — the backend still has to be secure
  regardless of pinning.
- **Exported component abuse:** craft intents (`adb shell am start ...`) to hit
  exported activities/services with unexpected data.
- **Runtime secrets & logic:** Frida to hook functions, dump decrypted strings,
  observe auth logic.
- **Logcat:** does the app log tokens, PII, or crash with sensitive stack
  traces?

---

## 3. MASVS category → what to test

| MASVS | Area | Key tests |
|-------|------|-----------|
| STORAGE | Data at rest | No plaintext secrets/PII in prefs/db/files; `allowBackup` off; keystore used for keys |
| CRYPTO | Cryptography | No hardcoded keys; no ECB/weak algos; proper IV/randomness |
| AUTH | Auth & session | Tokens stored securely; server-side session validation; biometric done right (not just a UI gate) |
| NETWORK | Transport | TLS enforced; no cleartext; cert pinning as defense-in-depth; ATS-equivalent config |
| PLATFORM | Platform interaction | Exported components locked down; safe WebView (no `setJavaScriptEnabled` with untrusted content, no `addJavascriptInterface` leaks); deeplink validation; no injection via IPC |
| CODE | Code quality | Debuggable off; no debug logging; obfuscation for sensitive logic (R8/ProGuard); up-to-date SDKs (cross-ref CVEs) |
| RESILIENCE | Anti-tampering | Root/tamper detection where warranted — note it's hardening, not a security boundary |

---

## 4. Tool cheatsheet

- **MobSF** — `docker run mobsf/mobsf`; upload APK → automated static + some
  dynamic report. Best first pass, covers most of section 1 and 3.
- **apktool** — resources + smali, manifest.
- **jadx / jadx-gui** — readable decompile for secret-hunting.
- **Frida / objection** — dynamic instrumentation, pinning bypass (test device).
- **adb** — manifest queries, component invocation, backup extraction, logcat.
- **nuclei / semgrep** — secret and misconfig patterns over decompiled source.

The backend endpoints you extract are the main event — run them through
`references/web_api.md`.
