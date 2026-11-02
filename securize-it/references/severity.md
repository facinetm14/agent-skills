# Triage & severity

The goal of triage is to tell the user what to fix *first*. A list of 40
findings sorted alphabetically helps no one; the same list sorted by real risk
to this app is the whole value of the report.

## Scoring: CVSS 3.1 as the baseline
Compute a CVSS 3.1 base score for each finding (use the FIRST.org calculator
vector string, record it in the finding). If the scope file gives you enough
context, add environmental metrics — a bug in an internet-facing prod auth flow
is worse than the same bug behind a VPN on staging.

Rough bands:
- **Critical (9.0–10):** remote, unauth, high impact — RCE, auth bypass, mass
  PII exposure.
- **High (7.0–8.9):** serious but needs some condition — IDOR exposing other
  users' data, SQLi behind auth, stored XSS.
- **Medium (4.0–6.9):** real but limited — reflected XSS needing interaction,
  info leaks, weak crypto not yet broken.
- **Low (0.1–3.9):** minor — missing headers, verbose errors, best-practice
  gaps.
- **Info:** no direct risk, worth noting.

## Then override with context — this is the important part
CVSS is a starting point, not the verdict. Re-rank by what actually matters here:

- **Data sensitivity.** IDOR leaking usernames ≠ IDOR leaking health records or
  payment data, even at the same CVSS. The second one jumps the queue.
- **Exploitability in practice.** A theoretically-High bug that needs a
  precondition that never holds in this app can drop; a Medium that's trivially
  automatable at scale can rise.
- **Blast radius.** One user vs every user. Business-ending vs annoying.
- **Chains.** Two Lows that combine into account takeover are reported as the
  chain, at the chain's severity.

State the reasoning in one line per finding so the user trusts the ordering:
"Ranked above F-002 despite lower CVSS because it exposes other patients' records."

## The roadmap
Translate the ranking into time horizons the user can act on:
- **Now (this week):** anything exploitable remotely with serious impact.
- **Next (this sprint):** high/medium that need a condition or interaction.
- **Later (this quarter):** hardening, low-severity, defense-in-depth.

A fix the user can schedule beats a severity score they can only stare at.
