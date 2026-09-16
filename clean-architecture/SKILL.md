---
name: clean-architecture
description: |
  Enforce Clean Architecture + Screaming Architecture in any language or framework.

  ALWAYS load this skill when the user:
  - Scaffolds a project, feature, module, or bounded context
  - Creates or names a use case, entity, repository, service, controller, port, or adapter
  - Asks to structure, restructure, or review the architecture of any backend codebase
  - Mentions: "clean architecture", "screaming architecture", "hexagonal", "ports and adapters",
    "domain layer", "use case", "bounded context", "DDD"
  - Asks to "organise the project", "structure this properly", or "refactor the architecture"

  Load even for small tasks (a single file, a method name, a folder rename) — architectural
  rules apply at every level, not only at project setup.

  Code examples use TypeScript as illustration; all rules are language-agnostic.
---

# Clean Architecture + Screaming Architecture

## When to apply this skill

Load and follow this skill for **any** of the following:

- Generating a new project structure, module, or feature scaffold
- Writing or naming a use case, entity, value object, repository, port, adapter, or controller
- Reviewing or refactoring existing code for architectural correctness
- Answering questions about how to organise, layer, or name things in a backend codebase

Architecture is enforced at **every level** — a single misnamed method or a one-line import in the wrong layer is a violation worth fixing.

---

## Core Principle

The folder structure and module names must **scream the domain**, not the framework.
A reader should immediately understand what the application _does_, not what tools it uses.

WRONG — screams the framework:

```
src/
  controllers/
  services/
  repositories/
  models/
```

RIGHT — screams the domain:

```
src/
  billing/
  user-management/
  inventory/
  shared/
```

---

## Screaming Architecture — Reveal Intent Everywhere

Screaming Architecture is not just about top-level folder names. It is a discipline applied at **every level** of the codebase: modules, files, classes, methods, variables. At every level, a reader should be able to answer _"what does this do for the business?"_ without reading the implementation.

### The test: the "new developer" rule

> A developer joining the project should understand what the system _does_ in under 60 seconds by reading the file tree alone — without opening a single file.

If the first thing they learn is "it uses Express" or "it has a database" → the architecture is not screaming loudly enough.

---

### Bounded contexts name business capabilities

Each top-level module is a business capability, not a layer.

```
WRONG                         RIGHT
src/                          src/
  controllers/                  loan-origination/
  services/                     risk-assessment/
  repositories/                 repayment-scheduling/
  utils/                        notifications/
  models/                       shared/
```

If you cannot name a module after a business concept, the boundary is probably wrong — split or merge until it makes sense to a domain expert.

---

### Use case names declare business intent

Use case names are the most important names in the codebase. They are the application's public contract expressed in the language of the domain.

```
WRONG                         RIGHT
UserService.process()         SubmitLoanApplication
DataManager.handle()          ApproveLoanApplication
OrderController.post()        RejectLoanApplication
run()                         DisburseLoanFunds
```

A list of use case files should read like a table of contents for the business:

```
loan-origination/application/
  SubmitLoanApplication
  ApproveLoanApplication
  RejectLoanApplication
  RequestAdditionalDocuments
  WithdrawApplication
```

---

### Domain types speak the ubiquitous language

Types, value objects, enums, and error names must come from the domain vocabulary — the same words domain experts use. If a domain expert would not recognise a type name, rename it.

```typescript
// WRONG — technical or generic names
type ID = string
type Status = number
class DataObject { ... }
class NotFoundException extends Error { ... }

// RIGHT — domain language
type LoanApplicationId = string
type LoanStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'DISBURSED'
class LoanApplication { ... }
class LoanApplicationNotFoundError extends Error { ... }
```

---

### Errors name what went wrong in business terms

```
WRONG                         RIGHT
ValidationError               LoanAmountExceedsPolicyLimitError
BadRequestException           ApplicantAgeRequirementNotMetError
Error 400                     InsufficientCreditScoreError
```

---

### File and method names make the intent local

Even inside a file, names should reveal purpose. Avoid generic verbs (`process`, `handle`, `run`, `manage`, `do`).

```
WRONG                         RIGHT
processData()                 calculateRiskScore()
handleRequest()               validateApplicantEligibility()
doStuff()                     scheduleFirstRepayment()
manager.execute()             loanApplication.submit()
```

---

### What "screaming" looks like end-to-end

A well-structured codebase for a lending platform should look like this at a glance:

```
src/
├── loan-origination/
│   ├── domain/
│   │   ├── LoanApplication          ← what it is
│   │   ├── LoanApplicationId
│   │   ├── LoanStatus
│   │   ├── ILoanApplicationRepository
│   │   └── errors/
│   │       ├── LoanAmountExceedsPolicyLimitError
│   │       └── InsufficientCreditScoreError
│   ├── application/
│   │   ├── SubmitLoanApplication    ← what you can do
│   │   ├── ApproveLoanApplication
│   │   ├── RejectLoanApplication
│   │   └── ports/
│   │       ├── ICreditBureauPort    ← what the app needs from the outside world
│   │       └── INotificationPort
│   └── infrastructure/
│       ├── persistence/
│       │   └── LoanApplicationPostgresRepository
│       ├── http/
│       │   └── LoanApplicationController
│       └── adapters/
│           ├── EquifaxCreditBureauAdapter
│           └── SendgridNotificationAdapter
```

Reading this tree alone tells you: this system handles loan applications; you can submit, approve, or reject them; it checks credit scores and sends notifications.

---

## Dependency Rule — NEVER violate this

Dependencies point **inward only**. Inner layers are completely unaware of outer layers.

```
[ Frameworks & Drivers ]  →  [ Interface Adapters ]  →  [ Application ]  →  [ Domain ]
        (outermost)                                                           (innermost)
```

- **Domain** — knows nothing. Zero imports from outer layers. Zero framework/library imports.
- **Application** — knows only Domain. No HTTP, no DB driver, no ORM, no framework type.
- **Interface Adapters** — translate between the app and the outside world. No business logic.
- **Frameworks & Drivers** — live at the edge and call inward. Never the other way around.

If you catch yourself importing a framework type into a use case or entity → **STOP and fix it**.

---

## Canonical Folder Structure

This layout is language-agnostic. Adapt file extensions and naming conventions to the target language, but preserve the logical hierarchy.

```
src/
├── {domain-concept}/               ← one module per bounded context (billing, orders…)
│   ├── domain/
│   │   ├── {Entity}                ← pure business object, zero dependencies
│   │   ├── {Entity}.test           ← unit tests, no infrastructure needed
│   │   ├── {IRepository}           ← interface/port defined by the domain's needs
│   │   └── errors/                 ← domain-specific exceptions / error types
│   ├── application/
│   │   ├── {DoSomething}UseCase    ← one class/function = one use case
│   │   ├── {DoSomething}UseCase.test
│   │   └── ports/                  ← outbound port interfaces (email, storage, events…)
│   └── infrastructure/
│       ├── persistence/
│       │   └── {Entity}{Adapter}Repository   ← concrete impl of IRepository
│       ├── http/                   ← controllers, route handlers, serializers
│       └── adapters/               ← external service adapters (email, S3, queues…)
├── shared/
│   ├── domain/                     ← shared value objects, base types, domain events
│   └── infrastructure/             ← DB connection, logger, config, shared middleware
└── main / entrypoint               ← composition root — only place that wires dependencies
```

---

## Entities

- Pure business objects. Encapsulate invariants and business rules.
- **No framework imports. No ORM annotations or decorators** inside the domain entity — use a separate persistence model if the ORM requires decoration.
- Invariants are enforced at construction time. An entity must never exist in an invalid state.

```typescript
// TypeScript example — same logic applies in any OO language
class Order {
  private constructor(
    readonly id: OrderId,
    readonly items: OrderItem[],
    private status: OrderStatus,
  ) {}

  static create(items: OrderItem[]): Order {
    if (items.length === 0) throw new EmptyOrderError();
    return new Order(OrderId.generate(), items, OrderStatus.PENDING);
  }

  confirm(): void {
    if (this.status !== OrderStatus.PENDING)
      throw new InvalidOrderTransitionError();
    this.status = OrderStatus.CONFIRMED;
  }
}
```

In non-OO languages (Go, Elixir, Haskell…), express the same as pure functions operating on immutable data structures with explicit validation at the boundary.

---

## Use Cases

- **One unit of behaviour = one use case.** Name it as a verb phrase: `PlaceOrder`, `CancelSubscription`, `GenerateInvoice`.
- Receives plain input data (DTO/struct/record), returns plain output data or nothing.
- Orchestrates domain objects — does **not** contain business rules itself.
- Depends on **interfaces/ports**, never on concrete implementations.
- Has zero knowledge of HTTP, CLI, queues, or any delivery mechanism.

```typescript
// TypeScript example
class PlaceOrderUseCase {
  constructor(
    private readonly orders: IOrderRepository, // interface, not a concrete class
    private readonly payment: IPaymentPort,
  ) {}

  async execute(input: PlaceOrderInput): Promise<PlaceOrderOutput> {
    const order = Order.create(input.items.map(OrderItem.from));
    await this.payment.charge(order.total);
    await this.orders.save(order);
    return { orderId: order.id.value };
  }
}
```

---

## Ports & Repositories

- The **interface/port** lives in `domain/` or `application/ports/` — defined by what the domain _needs_, expressed in domain terms.
- The **implementation** lives in `infrastructure/` — uses whatever DB, ORM, or external service.
- **Never leak** persistence types (ORM models, query builders, DB rows) outside `infrastructure/`.

```typescript
// domain/IOrderRepository — the contract
interface IOrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
}

// infrastructure/persistence/OrderPostgresRepository — the concrete adapter
class OrderPostgresRepository implements IOrderRepository {
  async save(order: Order): Promise<void> {
    // maps domain model → DB row/ORM record here
  }
}
```

The same pattern applies to any outbound dependency: email sender, file storage, event bus, third-party API. Define the port in `application/ports/`, implement it in `infrastructure/adapters/`.

---

## Interface Adapters (Controllers, Handlers, Presenters)

- **Thin.** Parse input → call use case → format output. Nothing more.
- Zero business logic. Zero domain rules.
- Map delivery-mechanism types (HTTP request, CLI args, queue message) → use case input DTOs.
- Map use case output → delivery-mechanism response (HTTP response, CLI output, event payload).

```typescript
// TypeScript example — same pattern for REST, GraphQL, CLI, queue consumers
class OrderController {
  async placeOrder(req: Request, res: Response) {
    const output = await this.placeOrderUseCase.execute({
      items: req.body.items,
    });
    res.status(201).json(output);
  }
}
```

---

## DTOs / Data Transfer Objects

- Plain data containers. No behaviour, no business logic.
- Used **only** to cross layer boundaries — domain entities must never cross them.
- Name them explicitly after their direction and use case: `PlaceOrderInput`, `PlaceOrderOutput`, `OrderSummaryView`.
- In statically typed languages, use whatever the idiom is: records, structs, dataclasses, plain objects.

---

## Composition Root

- A single entry point wires all concrete implementations to their interfaces.
- **Nowhere else** in the codebase may a concrete infrastructure class be instantiated.
- Use constructor injection (preferred) or a DI container — the point is that use cases and domain code never know which implementation they get.
- In functional languages, pass dependencies explicitly as parameters or use a Reader/Env pattern.

---

## Checklist — run this before writing any file

**Screaming Architecture**

- [ ] Does the module/folder name reflect a **business capability**, not a technical role?
- [ ] Can a new developer read the file tree and understand what the system _does_ without opening files?
- [ ] Do use case names read as a **business verb phrase** (`ApproveLoanApplication`, not `handleRequest`)?
- [ ] Do domain types, errors, and value objects use the **ubiquitous language** of the domain?
- [ ] Are there any generic names (`process`, `handle`, `manage`, `data`, `utils`) that should be renamed?

**Clean Architecture**

- [ ] Is the domain layer free of framework/library imports?
- [ ] Does the use case depend only on **interfaces**, not concrete classes?
- [ ] Is the adapter/controller thin (no business logic)?
- [ ] Are persistence/ORM types confined to `infrastructure/`?
- [ ] Can the domain and application layers be unit-tested **without a running server or database**?

If any answer is NO → fix the structure before writing.

---

## Anti-patterns — fix immediately, never generate these

| Anti-pattern                                                                          | Fix                                                                              |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Framework type (`Request`, `HttpContext`, `@Entity`) imported in a use case or entity | Create a plain DTO; map at the adapter boundary                                  |
| ORM model used directly as the domain entity                                          | Separate domain model from persistence model; map between them in infrastructure |
| Business logic in a controller/handler                                                | Move to the use case or domain entity                                            |
| Use case calling another use case                                                     | Extract shared logic to a domain service or domain method                        |
| Repository containing HTTP calls or external API logic                                | Create a dedicated outbound port + adapter                                       |
| Top-level folders named `services/`, `controllers/`, `models/`                        | Restructure by domain concept / business capability                              |
| One giant service class with many unrelated methods                                   | Split into focused, single-purpose use cases                                     |
| Domain event or entity leaking into the HTTP response directly                        | Map to a response DTO in the presenter/controller                                |
| Use case named `process`, `handle`, `run`, `execute`, `manage`                        | Rename to a business verb phrase (`ApproveLoanApplication`)                      |
| Error named `ValidationError`, `NotFoundException`, `BadRequest`                      | Rename to domain terms (`InsufficientCreditScoreError`)                          |
| Type or variable named `data`, `payload`, `obj`, `item`, `thing`                      | Rename to the domain concept it represents                                       |
| Module that mixes multiple unrelated business capabilities                            | Split into one module per capability                                             |

---

## Language adaptation

Apply these rules idiomatically. The architecture is the same; the syntax differs.

- **Go** — packages as bounded contexts; interfaces defined in the consuming package; structs as entities; explicit dependency passing.
- **Python** — abstract base classes or Protocol as ports; dataclasses or Pydantic models as DTOs _in the adapter layer only_; plain classes for domain.
- **Java/Kotlin** — interfaces as ports; records or value objects as DTOs; separate JPA `@Entity` from domain entity.
- **Elixir/Haskell/F#** — modules as bounded contexts; pure functions + explicit data; behaviours/typeclasses as ports.
- **Any language** — when in doubt: if the domain or application layer imports something from a framework or external library, it is wrong.

For detailed per-ecosystem conventions, read: 
-`references/adapters.md`.
- `references/domain-error.md`
