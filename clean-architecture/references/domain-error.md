## Domain Errors vs HTTP Statuses

The Domain and Application layers must never throw or return framework-specific HTTP errors (e.g., `HttpException`, `BadRequestError`). They declare what went wrong in business terms. The Interface Adapter (Controller) is responsible for catching these errors and mapping them to HTTP codes.

```typescript
// 1. IN THE DOMAIN (Pure business error)
export class InsufficientCreditScoreError extends Error {
  constructor(public readonly score: number) {
    super(`Credit score ${score} is below the required threshold.`);
    this.name = 'InsufficientCreditScoreError';
  }
}

// 2. IN THE APPLICATION LAYER (Use Case just propagates it)
export class ApproveLoanUseCase {
  async execute(command: ApproveLoanCommand): Promise<void> {
    const score = await this.creditBureau.getScore(command.applicantId);
    if (score < 600) {
      throw new InsufficientCreditScoreError(score); // Throwing domain intent
    }
  }
}

// 3. IN THE INFRASTRUCTURE LAYER (HTTP Controller maps to technical reality)
export class LoanController {
  async handle(req: Request, res: Response) {
    try {
      await this.approveLoanUseCase.execute(req.body);
      return res.status(200).json({ message: "Loan approved" });
    } catch (error) {
      // Clean mapping at the edge of the hexagon
      if (error instanceof InsufficientCreditScoreError) {
        return res.status(422).json({ type: error.name, message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}
```
