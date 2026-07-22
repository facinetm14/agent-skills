# Language & Ecosystem Adapter Notes

Loaded when the target stack is identified. The domain and application layers are always
framework-agnostic — only the infrastructure layer adapts to idioms below.

---

## TypeScript / JavaScript (framework-agnostic)

- No framework in `domain/` or `application/`. Plain classes and interfaces only.
- DI by constructor injection. Wire everything in `main.ts` (or an IoC container setup file).
- HTTP handler (Express, Fastify, Hapi…) lives in `infrastructure/http/`.
- Avoid putting route registration logic anywhere near the domain.

```
src/
├── orders/
│   ├── domain/Order.ts
│   ├── application/PlaceOrderUseCase.ts
│   └── infrastructure/
│       ├── http/OrderRouter.ts          ← registers routes, calls use case
│       └── persistence/OrderPgRepository.ts
└── main.ts                              ← composition root
```

---

## General rule across all stacks

Whatever the language or framework:

- If the domain or application layer imports something from a framework or ORM → wrong layer.
- If a controller contains a conditional or calculation beyond input mapping → extract to use case.
- If a repository method name is database-centric (`runQuery`, `executeSql`) → rename to domain terms (`findByCustomerId`, `save`).
