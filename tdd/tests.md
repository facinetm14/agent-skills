# Behavior-focused tests

Use this reference when choosing a difficult seam, designing complex tests, reviewing weak coverage, or recovering from an ineffective RED.

## Design the test around a break

Before writing, identify the outcome callers depend on and a realistic defect that violates it. Choose the smallest stable public boundary that can expose that defect: a domain operation, application use case, API, CLI, or UI. Prefer a broader integration seam when the behavior arises from collaborating components. A pure domain function can itself be a public seam; integration tests are not mandatory for every behavior.

Make expected values independent: derive them from requirements, worked examples, known fixtures, or independently checked properties. Avoid using the same production helper to compute actual and expected values. A test can have several assertions when they explain one cohesive behavior. Name the behavior and condition, not the internal steps.

```typescript
// Weak: mirrors the implementation's calculation.
expect(total(items)).toBe(items.reduce((s, item) => s + item.price, 0));

// Stronger: a known result from the contract.
expect(total([{ price: 10 }, { price: 5 }])).toBe(15);
```

```typescript
// Observable state through public use cases.
test('a registered user can be retrieved by id', async () => {
  const created = await register({ name: 'Alice' });
  expect(await getUser(created.id)).toMatchObject({ name: 'Alice' });
});
```

If persistence itself is the adapter's contract, query the real test database at that seam. Do not bypass higher-level interfaces merely to inspect their internals.

## Test selection and reliability

Choose representative normal cases and high-risk boundaries, validation failures, permissions, state transitions, and recovery paths. Add cases in order of risk and new information, not to reach an arbitrary coverage percentage. Prefer table-driven inputs for variations of one behavior when they remain readable; introduce new behaviors in separate RED/GREEN cycles.

Keep tests deterministic, isolated, and repeatable. Control clocks, random seeds, external services, and shared state where needed. Use fixtures and test-owned cleanup. Do not add production-only seams or methods solely to expose private state or clean up tests; legitimate dependency injection and resource lifecycle APIs are fine.

Avoid tests that merely verify framework mechanics, private fields, exact source text, constants detached from behavior, or mocks that have no causal connection to the outcome. Assert exact messages, call order, or call counts only when the contract actually requires them. For scripts, exercise exit status, output and effects. For agent instructions, evaluate what the consuming agent does under realistic prompts, not whether text contains mandatory phrases.

## Fast mutation review

For important behaviors, mentally introduce one plausible defect: wrong branch or value, missing validation, omitted write, extra side effect, or default return. Identify which test would fail. If none would, add a meaningful test through the loop or document why the risk is out of scope. For ambiguous or high-risk checks, an isolated temporary mutation can prove sensitivity; restore the exact pre-mutation state and rerun. Never edit user work or commit artificial mutations.

A good test changes when its contract changes, not whenever its implementation changes.
