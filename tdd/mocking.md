# When to Mock

Mock at **system boundaries** only:

- External APIs (payment, email, etc.)
- Databases (sometimes - prefer test DB)
- Time/randomness
- File system (sometimes)

Don't mock:

- Your own classes/modules
- Internal collaborators
- Anything you control

## Designing for Mockability

At system boundaries, design interfaces that are easy to mock:

**1. Use dependency injection**

Pass external dependencies in rather than creating them internally:

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. Prefer SDK-style interfaces over generic fetchers**

Create specific functions for each external operation instead of one generic function with conditional logic:

```typescript
// GOOD: Each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: Mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

The SDK approach means:
- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
- Type safety per endpoint

## TypeScript Port Mocking Example

When mocking an infrastructure port (like a repository), prefer **InMemory fake implementations** over framework magic (`jest.fn()` or `vi.fn()`). This ensures compile-time type safety and high performance.

```typescript
// THE PORT (Defined in application/ports/ILoanRepository.ts)
export interface ILoanRepository {
  findById(id: string): Promise<Loan | null>;
  save(loan: Loan): Promise<void>;
}

// THE IN-MEMORY FAKE (Defined locally in your test file)
export class InMemoryLoanRepository implements ILoanRepository {
  public loans: Map<string, Loan> = new Map();

  async findById(id: string): Promise<Loan | null> {
    return this.loans.get(id) || null;
  }

  async save(loan: Loan): Promise<void> {
    this.loans.set(loan.id, loan);
  }
}

// GOOD TEST USAGE (No external mocking library needed)
test("should approve loan when criteria are met", async () => {
  const fakeRepository = new InMemoryLoanRepository();
  const useCase = new ApproveLoanUseCase(fakeRepository); // Constructor injection
  
  // Setup state safely via public fields or methods
  fakeRepository.loans.set("loan-1", new Loan({ id: "loan-1", status: "PENDING" }));

  await useCase.execute({ loanId: "loan-1" });

  const updatedLoan = await fakeRepository.findById("loan-1");
  expect(updatedLoan?.status).toBe("APPROVED");
});
```
