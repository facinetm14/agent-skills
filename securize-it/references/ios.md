# iOS (IPA) testing playbook

Coverage backbone: **OWASP MASVS / MASTG**, same as Android. iOS is more
locked-down, and full dynamic analysis usually needs a jailbroken test device —
so static analysis carries more weight here, and the backend API is (again) the
richest target.

## Table of contents
1. Static analysis
2. Dynamic analysis (jailbreak-dependent)
3. MASVS category → tests
4. Tool cheatsheet

---

## 1. Static analysis

- **Unpack:** an IPA is a zip. Extract → `Payload/<App>.app/`. Run through
  **MobSF** for an automated pass.
- **Info.plist** — the high-value config file:
  - **ATS** (`NSAppTransportSecurity`): any `NSAllowsArbitraryLoads` /
    per-domain exceptions = weakened transport security → finding.
  - URL schemes / deeplinks the app registers — each is an input other apps can
    send; test validation.
  - Permissions and usage strings vs what the app needs.
- **Entitlements:** inspect with `codesign -d --entitlements`. Keychain access
  groups, associated domains (universal links), app groups — overly broad
  sharing is a finding.
- **Binary:**
  - Encryption/PIE/stack-canary flags (`otool`, `codesign`).
  - `strings` + decompile (Ghidra/Hopper) for hardcoded keys, tokens, backend
    URLs. Shipped secrets = public.
  - Embedded frameworks/SDKs → cross-ref CVEs.
- **Endpoints:** harvest every URL → run through `references/web_api.md`.
- **Data storage:** NSUserDefaults/plists/sqlite holding plaintext tokens or
  PII; Keychain used (good) or not (bad) for secrets; `Data Protection` class on
  sensitive files.

---

## 2. Dynamic analysis (jailbroken test device)

Without a jailbreak you're mostly limited to static + traffic interception on a
device you control.

- **Traffic:** proxy through Burp/ZAP, trust the CA, observe API calls. Pinning
  bypass via Frida/objection on the jailbroken test device if needed.
- **Runtime:** Frida to hook methods, dump decrypted strings, inspect Keychain,
  observe auth logic.
- **Filesystem:** inspect the app sandbox for what's written and how protected.

---

## 3. MASVS category → what to test

| MASVS | Area | Key tests |
|-------|------|-----------|
| STORAGE | Data at rest | Secrets in Keychain (not plists/UserDefaults); correct Data Protection class; no PII in plaintext |
| CRYPTO | Cryptography | No hardcoded keys; CommonCrypto/CryptoKit used correctly; no weak algos |
| AUTH | Auth & session | Secure token storage; server-side validation; biometrics via LocalAuthentication bound to Keychain, not a UI check |
| NETWORK | Transport | ATS enforced, no arbitrary-loads; pinning as defense-in-depth |
| PLATFORM | Platform interaction | Deeplink/URL-scheme & universal-link validation; safe `WKWebView` (no unvalidated content, careful `WKScriptMessageHandler`); pasteboard not leaking secrets |
| CODE | Code quality | Release build (no debug symbols/logs); PIE + stack canaries on; current SDKs |
| RESILIENCE | Anti-tampering | Jailbreak detection where warranted — hardening, not a boundary |

---

## 4. Tool cheatsheet

- **MobSF** — automated static report for IPAs; best first pass.
- **class-dump / Ghidra / Hopper** — headers and decompilation.
- **otool / codesign / plutil** — binary flags, entitlements, plist inspection.
- **Frida / objection** — dynamic instrumentation (jailbroken device).
- **Keychain-Dumper** — inspect stored secrets (test device).

As with Android, the extracted backend endpoints are where most exploitable
risk lives — push them through the web/API playbook.
