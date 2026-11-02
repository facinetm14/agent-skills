# Finding: {{short title}}

- **ID:** F-{{nnn}}
- **Target:** {{host / endpoint / component}}
- **Category:** {{OWASP ref, e.g. API1:2023 BOLA / MASVS-AUTH-1}}
- **Severity:** {{Critical|High|Medium|Low|Info}} (CVSS {{score}} — {{vector}})
- **Status:** Confirmed / Suspected

## Summary
{{One or two sentences: what's wrong and why it matters for THIS app.}}

## Reproduction
Exact steps, so the dev can see it fail and later see it fixed.

```
{{request / command}}
```
```
{{response / observed behaviour — redact real secrets}}
```

## Impact
{{What an attacker gains. Concrete: "reads any user's order history by
incrementing the id", not "information disclosure".}}

## Remediation
{{The fix, specific and actionable. Config change / code pattern / control.
Include a code sketch when it clarifies. Link the relevant OWASP cheat sheet.}}

## Verification
{{How to confirm it's closed — ideally re-run the reproduction and show it now
fails to exploit.}}
