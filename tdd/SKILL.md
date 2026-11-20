---
name: tdd
description: Use when implementing features, fixing bugs, changing observable behavior, writing regression or integration tests, or working test-first with red-green-refactor.
---

# Test-driven development

**Never make a behavioral production change before executing a test that fails for the intended missing or incorrect behavior.** A predicted failure is not evidence.

## Establish the contract

- Inspect existing tests, project test commands, `CONTEXT.md` (if present), and relevant ADRs. Preserve user changes. Run a relevant baseline before editing existing behavior when feasible; record pre-existing failures.
- Identify public seams (caller-visible interfaces), required behaviors, and high-risk cases. Use domain vocabulary. Confirm the seams and scope with the user unless already agreed or explicitly delegated. Do not reconfirm unchanged seams.
- Default to **supervised mode**: after each verified RED, present the test and actual failure, then end the turn until the user approves GREEN. Explicit authorization for autonomous TDD removes only this approval gate, never the verification gates. Persist the chosen mode for the task; silence is not consent.

## One vertical slice at a time

### 1. RED — specify and prove

- Choose one observable behavior at an agreed seam. Name the realistic defect the test should catch. Write one focused test with expectations derived independently from the contract.
- Exercise real application behavior through public interfaces. Use doubles only at justified boundaries. Read [tests.md](tests.md) for unfamiliar or complex test design; read [mocking.md](mocking.md) before introducing or changing doubles.
- Run the targeted test before changing production behavior. Confirm the test was collected and failed for the intended reason. If it passes, investigate whether the behavior already exists or the test is ineffective. Do not manufacture failure. Fix unrelated setup, syntax, or environment errors and rerun. For a missing API, a narrow interface declaration or inert stub is allowed before RED only to make the test executable; it must not implement the behavior.
- In supervised mode, provide the test (or path and diff), command, observed failure, and requested behavior. Stop until approval. In autonomous mode, record the same evidence and continue.

### 2. GREEN — implement and verify

- Make the smallest coherent production change that satisfies the test and existing contracts. No speculative abstractions, unrelated changes, or weakened assertions.
- Rerun the targeted test and relevant neighboring tests. If RED persists, diagnose the cause and fix the implementation; change the test only if its contract or setup is wrong, explain why, and re-establish valid RED before completing GREEN.
- Keep tests with the implementation. Only after GREEN, optionally remove local duplication or clarify names without changing behavior; rerun affected tests. Defer broader refactoring to code review. For pure refactoring of existing code, first establish passing characterization coverage; do not invent a failing behavioral test.

Repeat from RED for the next behavior. Never batch speculative tests and implementation into separate horizontal phases. Add boundary/error cases in priority order as the contract requires.

## Non-negotiable recovery rules

- Implemented first? Isolate and safely revert only your premature behavioral edits, then start with RED. Never delete or reset user work. If isolation is unsafe, stop and explain; do not claim TDD compliance.
- Cannot execute tests or achieve meaningful RED? Report the blocker. Do not implement the unverified slice without explicit permission to deviate. Prototypes, generated artifacts, or configuration changes that cannot be meaningfully exercised require an explicit exception; test observable effects where feasible.
- Existing failures? Record them, distinguish confirmed pre-existing failures from new or unknown failures, and fix regressions within scope. Do not silently skip, quarantine, or rewrite failing checks.

## Completion gate

Run the project's documented full test command after the final change (plus required checks). If unavailable or impractical, run the broadest feasible checks and state the limitation. Review whether plausible wrong outputs, branches, or missing side effects would be detected; add valuable missing cases through RED/GREEN.

Report actual RED/GREEN evidence, behaviors covered, final commands/results, and all observed remaining failures or unrun checks. Never label an unrun or failing suite green. Do not claim completion or strict TDD compliance when required evidence is missing.
