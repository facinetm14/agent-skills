# Engagement & authorization — handling grey areas

The scope gate exists because the legality and ethics of an offensive test turn
entirely on authorization, not on technique. Here's how to reason about the
cases that aren't black and white.

## The default
If a target isn't in the scope file, it's out. When in doubt, stop and ask the
user to either add it (with authorization recorded) or explicitly drop it. A
pause costs seconds; testing an unauthorized system can be a crime.

## Common grey areas

- **Shared / managed hosting.** Your app may sit on infrastructure you don't
  own (shared host, PaaS, managed DB). You're authorized for *your* app, not the
  provider's platform. Don't attack the hypervisor, neighbour tenants, or the
  provider's control plane. Many providers require advance notice even for your
  own instances — check their pentest policy (AWS, GCP, Azure each publish one).

- **Cloud metadata endpoints (169.254.169.254).** Reachable via SSRF and
  genuinely high-impact, but hitting it touches the cloud provider's surface.
  Test only if the scope file explicitly allows it, and treat a reachable
  metadata service as a finding to *report*, not a door to walk through further.

- **Third-party dependencies in traffic.** OAuth IdPs (Google, Apple), payment
  processors (Stripe), CDNs, analytics — these show up when you intercept the
  app's traffic. They are out of scope by default and belong in
  `out_of_scope`. You test how *your* app uses them (does it validate the
  response? leak a token?), never the third party itself.

- **Staging vs production.** Prefer staging for anything aggressive. If prod is
  the only option, tighten rate limits, avoid destructive classes, and schedule
  within the agreed window. Data mutation on prod needs explicit opt-in.

- **Bug bounty scope.** If the authorization is a public program, its scope page
  *is* the rules — mirror it exactly into the scope file, including the explicit
  out-of-scope and prohibited-technique lists. Those lists are binding.

- **Found credentials / accessible data.** If a test exposes real user data or
  working credentials, stop expanding. Document enough to prove impact, don't
  exfiltrate or pivot, and report it. Demonstrating a door is open is the job;
  walking through to rifle the house is not.

## Third-party authorization — how to treat it
Plenty of legitimate testing is on someone else's app: a client hires you, an
employer assigns you, a friend asks you to check their app and tell them what to
fix. These are exactly what the skill is for.

The authorization record (the `third_party` block) is an **engagement of
responsibility, not a document you authenticate.** You can't cryptographically
verify a PDF or an email, and you don't try to. What the record does is make the
engagement *traceable and accountable*: it names who authorized, the exact
target covered, and how it's evidenced. By filling it in, the tester vouches for
it. That's the real-world standard for coordinated disclosure between
individuals and for most consulting engagements.

So when a user says "here's my friend's app and here's their authorization
naming it, find bugs so they can fix them" — that's a go. Record who/what/ref,
**bound the scope to the exact named target** (that one app, nothing else the
owner didn't name), set purpose to coordinated disclosure, and proceed.

## Where the line actually is
The gate is not "is there a file?" — it's "is the described engagement
legitimate?" Refuse, regardless of any attached file, when the *scenario itself*
is an abuse pattern that no genuine owner authorizes:

- Accessing a third party's private communications, accounts, or messages
  without that person's own consent (intimate-partner surveillance, stalking,
  "help me get into their phone/DMs"). The "authorization" in these cases is
  typically forged or coerced — the tell is that the person whose data is at
  risk is not the person giving permission.
- Testing something the user merely has an account on, uses at work without
  sign-off, or finds interesting. "I use it" is not "I'm authorized to attack
  it."

For a legitimate third-party engagement, help the user record it and proceed.
For an abuse pattern, say so plainly and don't proceed — and if they're unsure
how to get real authorization for a borderline-but-legitimate case, help them
scope it and get it in writing.
