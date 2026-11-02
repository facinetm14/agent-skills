---
name: securize-it
description: >-
  Attack-defense pentest for the user's OWN web apps, APIs, and mobile apps
  (Android APK / iOS IPA). Use this skill whenever the user wants to security
  test, pentest, "attack", audit, find vulnerabilities in, harden, or securize
  an application they own or are authorized to test — even when they phrase it
  casually ("casse mon appli", "trouve les failles de mon API", "is my app
  secure", "red team my backend", "check my APK for leaks"). Drives a full
  loop: scope + authorization gate → recon → attack-surface mapping →
  adversarial testing → triage → concrete remediation. Each weakness found is
  paired with a fix. Do NOT use to attack third-party systems the user has no
  authorization for; the skill's first step refuses out-of-scope targets.
disable-model-invocation: true
---

# securize-it

A disciplined attack-defense workflow. You play the adversary against an
application the user owns, you find what a real attacker would find, and then —
this is the half that makes it a security tool rather than an intrusion kit —
you hand back a prioritized set of fixes for every weakness.

The whole thing rests on one load-bearing idea: **offensive testing is only
legitimate inside an authorized scope.** The exact same port scan is defensive
on your own staging box and a crime against someone else's. So the skill opens
with a scope gate, and nothing aggressive happens until it's passed. This isn't
bureaucratic caution — a pentest report that can't name its authorization is
worthless to the user anyway (they can't act on findings for a system they
don't control), so the gate also just makes the output useful.

## Operating principles

- **Authorized scope only.** You test what the engagement file lists and
  nothing else. A target outside it stops the run until the user confirms.
- **Prefer established tools over bespoke exploits.** Orchestrate ZAP, nuclei,
  MobSF, testssl.sh, etc. They encode years of accumulated attacker knowledge,
  they're maintained, and their output is auditable. Writing a one-off exploit
  script is almost never the right move for coverage — reserve it for
  confirming a specific finding the tools flagged.
- **Every finding carries a fix.** A vulnerability with no remediation is a
  liability, not a deliverable. The report structure enforces this pairing.
- **Non-destructive by default.** You demonstrate a weakness; you don't drop
  tables, exhaust the target, or pivot into data you don't need. Destructive or
  high-impact tests (fuzzing that may DoS, auth brute force, data modification)
  require explicit per-test opt-in recorded in the scope file.
- **Reproducibility.** Findings a user can't reproduce, they can't fix. Record
  the exact command, request, and response for each one.

## The loop

### 0. Scope & authorization gate — always first

Before any scanning, establish the rules of engagement. If the user hasn't
provided a scope file, create one with them using
`templates/scope.yaml`. It captures:

- **Targets** — exact hostnames, IP ranges, URLs, package names, app builds.
  In-scope only; anything not listed is out.
- **Authorization** — two legitimate paths. For the user's own apps,
  self-attestation is fine (`owner: true`). For a third party's app (a client, an
  employer, a friend who wants their app checked so they can fix it), the file
  records who authorized, the exact named target it covers, and how it's
  evidenced. This record is an engagement of responsibility, not a document you
  authenticate — you can't verify a PDF, so you don't try; filling it in is the
  tester vouching for it, which is the real standard for coordinated disclosure.
  A third-party authorization naming the target is a green light: record it,
  bound the scope to exactly that target, and proceed.
- **Allowed aggression** — which destructive/high-impact test classes are
  permitted (default: none). Brute force, fuzzing, DoS-adjacent load, and data
  mutation each opt in here.
- **Windows & rate limits** — when testing may run, and caps to avoid knocking
  over production.
- **Out-of-bounds** — third-party services the app depends on (payment
  providers, OAuth IdPs, CDNs) that must never be targeted even though they
  appear in traffic.

If a requested target isn't in the file, don't test it — surface it and ask the
user to add it (confirming authorization) or drop it. The gate's real question
is not "is there a file?" but "is this engagement legitimate?" A named
third-party authorization for coordinated disclosure passes; an abuse pattern
(accessing someone's private messages/accounts without *their* consent —
partner surveillance, stalking) is refused no matter what file is attached,
because the person whose data is at risk isn't the one giving permission. Read
`references/engagement.md` for this line and for grey areas (shared hosting,
cloud metadata endpoints, staging vs prod).

### 1. Recon & attack-surface mapping

Build a picture of what you're attacking before you attack it. The point is
coverage: a vuln on an endpoint you never discovered is a vuln you'll never
report.

- **Web/API**: enumerate hosts, subdomains, ports, tech stack, routes, API
  schemas (OpenAPI/GraphQL introspection), auth flows, cookies/headers.
- **Android**: unpack the APK, read the manifest (exported components,
  permissions, `android:debuggable`, cleartext traffic config), identify SDKs,
  pull endpoints and secrets from the decompiled code.
- **iOS**: inspect the IPA, Info.plist, entitlements, ATS exceptions, embedded
  frameworks, and string-extractable endpoints/keys.

Each platform has a dedicated playbook — read the one(s) that match the engagement:
- `references/web_api.md`
- `references/android.md`
- `references/ios.md`

`scripts/recon.sh` orchestrates the common web recon chain. For mobile, the
playbooks drive the MobSF / apktool / class-dump flows.

### 2. Adversarial testing

Now attack, systematically, against a coverage model so you're not just poking
at whatever's obvious. Use the OWASP checklists as the backbone:

- **Web/API** → OWASP Top 10 + OWASP API Security Top 10 + ASVS. The
  `references/web_api.md` file maps each category to concrete tests and the
  tool/command that exercises it.
- **Mobile** → OWASP MASVS / MASTG. `references/android.md` and
  `references/ios.md` map MASVS categories to tests.

Work from the checklist, not from vibes — the value of a pentest is in the
boring categories you'd skip if you were freestyling (e.g. mass assignment,
BOLA/IDOR on every object reference, JWT algorithm confusion, insecure
deeplinks). `scripts/scan_web.sh` runs the automated baseline (ZAP baseline +
nuclei + testssl); you then do the manual, logic-level testing the scanners
can't: authorization boundaries, business-logic abuse, multi-step flows.

Record every confirmed finding as you go using `templates/finding.md` so
nothing is lost between testing and reporting.

### 3. Triage & severity

Rate each finding with CVSS 3.1 (base, plus environmental if the scope file
gives you enough context) and a plain-language impact statement. Sort by real
risk to *this* app, not by raw score — an IDOR exposing other users' PII in a
health app outranks a missing security header even if CVSS says otherwise.
`references/severity.md` has the scoring guidance and the triage rubric.

### 4. Remediation & report

Produce the deliverable with `templates/report.md`. For every finding:

1. What it is, where, and how to reproduce (exact request/response).
2. Severity + impact in this app's context.
3. **The fix** — specific and actionable: the config change, the code pattern,
   the library, the control. Not "validate input" but *which* validation,
   *where*, with a code sketch when it helps. Reference the relevant OWASP
   cheat sheet.
4. Verification step — how to confirm the fix closed it (ideally the same test
   that found it, now failing to exploit).

Close with a prioritized remediation roadmap: what to fix this week, this
sprint, this quarter.

## Tooling

`scripts/check_env.sh` reports which tools are installed and how to get the
missing ones. The skill degrades gracefully — if a tool is absent, the
corresponding playbook notes the manual fallback. In a sandbox without the
target reachable, the recon/scan scripts run in dry-run mode and print the
commands they *would* run, so the user can execute them in their own authorized
environment.

Nothing in this skill should run against a target the scope file doesn't list.
If you're ever unsure whether something is in scope, stop and ask — that pause
is cheaper than the alternative.
