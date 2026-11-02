# Web & API testing playbook

Coverage backbone: **OWASP Top 10 (2021)** + **OWASP API Security Top 10
(2023)** + **ASVS** for depth. Work the checklist top to bottom — the findings
that matter are usually in the categories you'd skip if freestyling.

## Table of contents
1. Recon (what to enumerate)
2. OWASP Top 10 — tests & tools
3. OWASP API Top 10 — tests & tools
4. The manual, logic-level tests scanners miss
5. Tool cheatsheet

---

## 1. Recon

Goal: enumerate the full attack surface before attacking it.

- **Hosts/subdomains:** `subfinder`, `amass`, cert transparency (crt.sh).
- **Ports/services:** `nmap -sV` (within rate limits; skip on shared hosting).
- **Tech stack:** `whatweb`, `httpx`, response headers, cookies, JS bundles.
- **Routes/content:** `ffuf`/`feroxbuster` with a sane wordlist; parse sitemaps,
  robots.txt, JS source maps for hidden endpoints.
- **API schema:** fetch OpenAPI/Swagger JSON; for GraphQL, attempt introspection
  (`__schema`) — if it's enabled in prod, that's already a finding.
- **Auth model:** identify session vs token (JWT/opaque), where creds live,
  refresh flow, MFA presence.

`scripts/recon.sh` chains the common web steps and writes an inventory.

---

## 2. OWASP Top 10 (2021) → concrete tests

| Cat | Name | What to actually test | Tool |
|-----|------|----------------------|------|
| A01 | Broken Access Control | Access another user's object by changing id (IDOR); reach admin routes as a normal user; force-browse; method tampering (GET vs POST) | manual + Autorize (Burp) |
| A02 | Cryptographic Failures | TLS config, weak ciphers, cleartext transport, secrets in responses/JS, weak password hashing if observable | `testssl.sh` |
| A03 | Injection | SQLi, NoSQLi, command, LDAP, SSTI, header injection; test every param, header, JSON field | `sqlmap` (authorized!), nuclei, manual |
| A04 | Insecure Design | Missing rate limits, no lockout, guessable flows, trust boundaries | manual review |
| A05 | Security Misconfiguration | Default creds, verbose errors/stack traces, dir listing, missing headers (CSP, HSTS, X-Content-Type), CORS wildcard with creds | nuclei, manual |
| A06 | Vulnerable Components | Fingerprint libs/versions, cross-ref known CVEs | `nuclei -t cves/`, retire.js |
| A07 | Auth Failures | Weak password policy, session fixation, predictable tokens, JWT flaws (alg=none, weak secret, no exp) | manual + jwt_tool |
| A08 | Integrity Failures | Unsigned updates, insecure deserialization, CI/CD exposure | manual |
| A09 | Logging/Monitoring | Are attacks detectable? (often out of band — note gaps) | review |
| A10 | SSRF | Any feature fetching a URL server-side; test internal IPs, cloud metadata (169.254.169.254 — only if in scope) | manual + nuclei |

---

## 3. OWASP API Security Top 10 (2023)

APIs fail differently from UIs — authorization per-object and per-function is
where most real damage lives.

| Cat | Name | Test |
|-----|------|------|
| API1 | BOLA (object-level authz) | For EVERY endpoint taking an object id, try another user's id. The single most common high-impact API bug. |
| API2 | Broken Authentication | Token handling, weak JWT, no expiry, creds in URL |
| API3 | Broken Object Property Level Authz | Mass assignment (send extra fields like `role:admin`); excessive data exposure (API returns more than the UI shows) |
| API4 | Unrestricted Resource Consumption | Missing rate limits, no pagination caps, costly GraphQL queries |
| API5 | Broken Function Level Authz | Call admin functions as a normal user; guess undocumented verbs |
| API6 | Unrestricted Access to Sensitive Business Flows | Automate a flow meant to be human-paced (bulk signup, scalping) |
| API7 | SSRF | Same as A10 |
| API8 | Misconfiguration | CORS, headers, verbose errors |
| API9 | Improper Inventory Mgmt | Old API versions (`/v1` still live), debug/staging hosts |
| API10 | Unsafe Consumption of 3rd-party APIs | Trusting upstream data without validation |

---

## 4. What the scanners miss — do these by hand

Automated tools find the mechanical bugs. The expensive findings are logic:

- **Authorization matrix:** build a grid of roles × endpoints and verify each
  cell. Tools can't infer your intended permissions.
- **Multi-step flow abuse:** skip step 2 of a 3-step checkout; replay a
  one-time action; race conditions (double-spend) with parallel requests.
- **Business logic:** negative quantities, price manipulation client-side,
  coupon stacking, workflow state jumps.
- **Chained low-severity → high:** an info leak + a weak token together.

---

## 5. Tool cheatsheet (orchestrated, not reinvented)

- **OWASP ZAP** — `zap-baseline.py -t <url>` (passive, safe) or active scan when
  authorized. Good default web coverage.
- **nuclei** — templated checks for CVEs, misconfig, exposures. Fast, low-noise.
- **testssl.sh** — TLS/crypto posture in one command.
- **sqlmap** — SQLi confirmation. Only with `data_mutation`/active scanning
  authorized; it can be heavy.
- **jwt_tool** — JWT attacks (alg confusion, weak key, tampering).
- **ffuf / feroxbuster** — content discovery.
- **Burp Suite** — the manual workhorse (Repeater, Intruder, Autorize for IDOR).

`scripts/scan_web.sh` runs the safe automated baseline (ZAP baseline + nuclei +
testssl) and aggregates output. Manual testing is on you after that.
