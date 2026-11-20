# Test doubles and boundaries

Read before introducing or changing mocks, fakes, stubs, or spies.

## Decide what to replace

Keep the behavior under test and its internal application collaborators real by default. Replace only a dependency that is external, nondeterministic, unsafe, unavailable, or prohibitively expensive. Typical examples: remote services, clocks, random sources, payment gateways, and infrastructure ports. Prefer a real isolated database or filesystem when their semantics are part of the contract. Never call live production services for tests.

Inspect the real dependency's contract and side effects. Replace the narrow operation below the side effects the test needs. A double must reproduce the relevant documented inputs, results, errors, and state transitions with realistic values; do not fabricate responses that would be impossible in production. Cover important adapter behavior separately against an appropriate real or sandboxed integration. A faithful fake is not a substitute for testing constraints, transactions, or serialization that only real infrastructure can enforce.

## Choose the simplest faithful double

- Stub fixed boundary responses; use a fake for stateful behavior; use a spy or mock for meaningful outgoing interactions.
- Prefer typed, small in-memory fakes for repository ports when storage semantics are not under test. Reuse existing fixtures and doubles before creating more.
- Assert interaction arguments, counts or ordering only when they are externally observable requirements (e.g. exactly one payment charge or no email on rejection). Do not assert that a mock exists or that internal methods were called merely because they currently are.
- Use dependency injection at genuine boundaries. Prefer operation-specific ports when they fit the domain; do not introduce a generic abstraction or new public interface merely to make a test easier.

```typescript
interface LoanRepository {
  findById(id: string): Promise<Loan | null>;
  save(loan: Loan): Promise<void>;
}

class InMemoryLoanRepository implements LoanRepository {
  private loans = new Map<string, Loan>();

  async findById(id: string): Promise<Loan | null> {
    const loan = this.loans.get(id);
    return loan ? structuredClone(loan) : null;
  }

  async save(loan: Loan): Promise<void> {
    this.loans.set(loan.id, structuredClone(loan));
  }
}
```

Illustrative only: this fake assumes Loan is a cloneable data record and the real port has equivalent copy semantics. Adapt it to the actual contract (e.g. domain entity reconstruction, uniqueness and write behavior). Seed through the port, exercise the real use case, and assert the outcome at the agreed seam.

If double setup dominates the test, its behavior is hard to explain, or multiple internal modules need replacement, simplify the test boundary or use a real integration instead.
