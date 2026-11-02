# Security Assessment — {{app name}}

- **Engagement:** {{scope.engagement.name}}
- **Tester:** {{tester}}
- **Dates:** {{start}} → {{end}}
- **Scope tested:** {{targets, summarized}}
- **Authorization:** {{owner / ref to authorization artifact}}

> Testing was confined to the authorized scope above. No third-party or
> out-of-scope systems were targeted.

## Executive summary
{{3–6 sentences for a non-technical reader: overall posture, how many findings
by severity, the one or two things that genuinely matter, and the headline
recommendation.}}

| Severity | Count |
|----------|-------|
| Critical | {{n}} |
| High     | {{n}} |
| Medium   | {{n}} |
| Low      | {{n}} |
| Info     | {{n}} |

## Prioritized remediation roadmap
What to fix, in order of real risk to this app.

**Now (this week)**
- [ ] {{F-001 — ...}}

**Next (this sprint)**
- [ ] {{F-002 — ...}}

**Later (this quarter / backlog)**
- [ ] {{F-003 — ...}}

## Findings
{{One section per finding, each from templates/finding.md, ordered by severity.}}

## Methodology
Brief note on what was and wasn't tested, the coverage model used (OWASP Top 10
/ API Top 10 / MASVS), tools run, and any areas left for a follow-up pass
(e.g. destructive tests that weren't authorized this round).

## Appendix: tooling & versions
{{Tools and versions used, for reproducibility.}}
