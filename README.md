# furniture-backend (NestJS)

A NestJS port of the Fastify furniture storefront backend. Same domain, same database schema, same
money flow — different framework, deliberately.

**Why do it twice?** The Fastify build taught the *domain*: what an order is, why the webhook is the
source of truth, why stock can only be decremented atomically. That thinking is done and written
down. This repo re-solves the same, already-understood problem in Nest, so the only new thing to
learn is **Nest itself** — modules, dependency injection, guards, pipes, filters. That's the OOP
model used at work, so it's the transferable half.

The Fastify repo remains the reference implementation. When something here is unclear, go read how it
was solved there.

👉 **Start with [NEST-GUIDE.md](NEST-GUIDE.md)** — it maps every Fastify concept you already built to
its Nest equivalent, and holds the per-milestone task checklists.

---

## Architecture at a glance

```
   Frontend  ──────────────►  This API (NestJS)  ──────────►  Postgres
  (Next.js)                          │                        users · carts
      │                              │                        orders · order_items
      │                              │                        inventory · payments
      │                              ▼
      └──────────────────────►    Sanity  (catalogue: names, prices, images, copy)
         product browsing              ▲
                                       │
                                  Paystack ──► webhook ──► this API
```

**Why two datastores?** They hold different kinds of truth.

- **Sanity owns the catalogue.** Product names, descriptions, images, prices. Content people edit it
  freely; it changes often; nothing breaks if it's briefly stale.
- **Postgres owns money and state.** Users, carts, orders, inventory, payments. This data must be
  consistent, must survive concurrent writes, and must be correct to the kobo. A CMS gives you no
  transactions, no locking and no referential integrity — so none of this can live there.

Products are joined to cart rows **in memory at request time**: cart rows store only a Sanity
`productId`, the product data is fetched from Sanity, and the two are merged. That's why there's no
`Product` table. In Fastify this was `src/lib/util.ts → buildCart`; here it becomes a method on
`CartService`.

**One important consequence:** the moment an order is created, product data is **copied** into
`OrderItem` (name, slug, image, unit price). Orders are snapshots. If a price changes in Sanity
tomorrow, a past order must not change with it.

---

## Tech stack

| | |
|---|---|
| Runtime | Node.js 22, TypeScript 5.9, CommonJS emit (`module: nodenext`) |
| Framework | NestJS 11, **Express adapter** (the scaffold default — don't switch it) |
| Database | PostgreSQL |
| ORM | Prisma (schema copied from the Fastify project) |
| Validation | `class-validator` + `class-transformer` via a global `ValidationPipe` |
| Config | `@nestjs/config` with a boot-time validation schema |
| Auth | `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`, `bcrypt` |
| Catalogue | Sanity (`@sanity/client`) |
| Payments | Paystack |
| Testing | Jest + supertest (already scaffolded) |
| Dev | `nest start --watch` |

**Note on validation:** the Fastify build used Zod. This one uses `class-validator` DTOs on purpose —
it's the idiomatic Nest pattern and almost certainly what you'll meet in your company's codebase. See
[NEST-GUIDE.md](NEST-GUIDE.md) Part A for the translation.

---

## Getting started

```bash
npm install

# N1 dependencies
npm i @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt \
      class-validator class-transformer
npm i -D @types/passport-jwt @types/bcrypt
npm i prisma -D && npm i @prisma/client

# N2 dependencies
npm i @sanity/client

# N3 dependencies — Paystack has no official Node SDK; use fetch (built in on Node 22)
# nothing to install

cp .env.example .env         # then fill in the values
npx prisma migrate dev       # against a NEW database, see below
npm run start:dev            # http://localhost:3000
```

### Environment variables

| Variable | Needed by | Notes |
|---|---|---|
| `DATABASE_URL` | N1 | **Point at a new, empty database.** See below. |
| `JWT_SECRET` | N1 | Any long random string in dev |
| `JWT_EXPIRES_IN` | N1 | e.g. `15m` |
| `PORT` | N1 | Read via `ConfigService`, not `process.env` directly |
| `SANITY_PROJECT_ID` | N2 | Same values as the Fastify project |
| `SANITY_DATASET` | N2 | |
| `SANITY_API_VERSION` | N2 | |
| `PAYSTACK_SECRET_KEY` | N3 | Test key. Used for both the init call and the webhook HMAC |
| `PAYSTACK_PUBLIC_KEY` | N3 | |

> ⚠️ **`DATABASE_URL` must be a different database from the Fastify app's.** The schema is the same,
> but two apps cannot share one Prisma migration history — a `migrate dev` run from here would rewrite
> the other project's schema. Create `furniture_nest` alongside `furniture` and keep them independent.
> That's also what lets you break things here without fear.

### Testing webhooks locally (N3)

Paystack has to reach your machine, which `localhost` doesn't allow. Expose it with a tunnel:

```bash
npx localtunnel --port 3000       # or: cloudflared tunnel --url http://localhost:3000
```

Then set the resulting HTTPS URL as the webhook URL in the Paystack dashboard
(Settings → API Keys & Webhooks), pointing at `/payments/webhook`. **This step is where everyone
gets stuck** — if webhooks aren't arriving, check the tunnel before you touch your code.

---

## Planned module structure

The map before the territory. Nothing below exists yet except `main.ts` and `app.module.ts`.

```
src/
  main.ts                     bootstrap: ValidationPipe, rawBody, port from ConfigService
  app.module.ts               imports every feature module

  prisma/
    prisma.service.ts         extends PrismaClient, implements OnModuleInit
    prisma.module.ts          @Global() — the one module that earns it

  config/
    env.validation.ts         fail at boot if a var is missing, not at 2am

  common/
    decorators/               @CurrentUser, @Roles, @Public
    guards/                   JwtAuthGuard, RolesGuard, PaystackSignatureGuard
    filters/                  PrismaExceptionFilter (P2002 → 409)

  sanity/
    sanity.service.ts         the ONLY place @sanity/client is touched
    sanity.module.ts

  users/                      UsersService (findByEmail, create), profile endpoint
  auth/                       AuthController, AuthService, DTOs, JwtStrategy
  cart/                       CartController, CartService (buildCart lives here)
  orders/                     checkout + order read endpoints
  inventory/                  stock per Sanity product id, seeded by a script
  payments/                   init + webhook
```

One rule that keeps this honest: **controllers speak HTTP, services hold logic.** A controller method
should be three lines — pull the input, call the service, return. If business logic is leaking into a
controller, it's in the wrong file.

---

## Domain model

What each table means in business terms — the tables *are* the business model. Schema copied
unchanged from the Fastify project.

| Table | What it represents |
|---|---|
| `User` | A person who can log in. Holds a role (`ADMIN` / `CUSTOMER`) and loose location fields. |
| `Cart` | One row = one product a customer intends to buy, with a quantity. Unique on `(userId, productId)`, so adding twice increments rather than duplicating. Mutable, disposable, no money meaning. |
| `Order` | A customer's committed intent to buy, created at checkout **before** payment. Carries the status, the frozen totals, and the delivery snapshot. Immutable once created. |
| `OrderItem` | A line on an order, with product details **copied in** at creation time. This is what makes an order a historical record rather than a live query. |
| `Inventory` | Stock quantity per Sanity product id. Postgres owns this so decrements can be atomic and oversells impossible. |
| `Payment` | One attempt to pay for an order, keyed by the Paystack reference. One order can have many attempts — fail, retry, succeed. This is the audit trail for "I was debited". |

Order statuses: `PENDING → PAID → PROCESSING → SHIPPED → DELIVERED`, plus `CANCELLED`, `EXPIRED`,
`FAILED`, `REFUNDED`.

---

## The money flow

**Read this first when you come back cold.** This is the sequence the whole project exists to get
right, and it must not drift between the Fastify and Nest implementations.

```
1. POST /checkout
      Snapshot the cart into Order(PENDING) + OrderItems, with prices frozen.
      The order exists BEFORE any money moves.

2. POST /payments/init
      Server re-derives the amount from order.total (never trusts the client),
      asks Paystack to initialise a transaction, returns an authorization URL.

3. Customer pays on Paystack's hosted page.
      Card details never touch this server.

4. POST /payments/webhook   ◄── Paystack calls us. THIS is the source of truth.
      a. Verify the HMAC signature against the RAW request body.
      b. Verify the paid amount and currency match the order snapshot.
      c. If the order is already PAID → return 200 and do nothing (idempotency).
      d. Otherwise, in ONE transaction:
            Order.status = PAID
            decrement inventory (conditionally: only where stock >= quantity)
            clear the customer's cart
            write the Payment row
      e. Return 200 quickly, or Paystack will retry.

5. GET /orders/:id
      The customer sees the result. Scoped to their own userId.
```

### The three rules that make this safe

1. **The frontend's "payment successful" redirect is a UI event, not a fact.** Anyone can visit that
   URL. Only a signed webhook — or a server-side call to Paystack's verify endpoint — may move an
   order to `PAID`.
2. **The webhook will be delivered more than once.** Paystack retries on any non-2xx response and
   sometimes duplicates outright. A non-idempotent handler decrements stock twice for one payment.
3. **Never trust a client-supplied amount.** Re-derive it from `order.total` on the way out, and
   re-verify it on the way back in. A mismatch means don't mark it paid.

### Why the order is created before payment

If orders were only created after successful payment, a customer who pays while the server is down
would have money gone and nothing to point at. The `PENDING` order is the paper trail that makes that
situation recoverable.

---

## API reference

All authenticated routes expect `Authorization: Bearer <accessToken>`.

| Method | Path | Auth | Nest artefact | Milestone |
|---|---|---|---|---|
| POST | `/auth/register` | — | `AuthController.register` · `RegisterDto` | N1 |
| POST | `/auth/login` | — | `AuthController.login` · `LoginDto` | N1 |
| GET | `/profile` | `JwtAuthGuard` | `UsersController.profile` · `@CurrentUser()` | N1 |
| POST | `/cart` | `JwtAuthGuard` | `CartController.add` · `AddToCartDto` | N2 |
| GET | `/cart` | `JwtAuthGuard` | `CartController.find` → `CartService.buildCart` | N2 |
| PUT | `/cart/:productId` | `JwtAuthGuard` | `CartController.updateQuantity` · `UpdateCartDto` | N2 |
| DELETE | `/cart/:productId` | `JwtAuthGuard` | `CartController.removeOne` | N2 |
| DELETE | `/cart` | `JwtAuthGuard` | `CartController.clear` | N2 |
| POST | `/checkout` | `JwtAuthGuard` | `OrdersController.checkout` · `CheckoutDto` | N2 |
| POST | `/payments/init` | `JwtAuthGuard` | `PaymentsController.init` · `InitPaymentDto` | N3 |
| POST | `/payments/webhook` | `PaystackSignatureGuard` | `PaymentsController.webhook` — **raw body, no DTO** | N3 |
| GET | `/orders` | `JwtAuthGuard` | `OrdersController.findAll` — paginated | Buffer |
| GET | `/orders/:id` | `JwtAuthGuard` | `OrdersController.findOne` — filter by `id` **and** `userId` | Buffer |

---

## Timeline

Start **Thu 13 Aug 2026**. Target **Mon 31 Aug**. Hard stop **Sun 6 Sep**. ~5 hrs/week.

Three build weeks and one buffer week that is *named*, not hoped for.

| | Dates | Milestone | Done when |
|---|---|---|---|
| **N1** | Thu 13 – Wed 19 Aug | **Foundations + auth.** ConfigModule, PrismaService, common layer, users + auth, JWT guard, `@CurrentUser`, profile | Register → login → `GET /profile` with a Bearer token works, and you can explain why `AuthService` is *injected* rather than imported |
| **N2** | Thu 20 – Wed 26 Aug | **Sanity + cart + checkout.** SanityService, cart CRUD, `buildCart` port, checkout with every M1 guard carried over | Checkout snapshots a cart into `Order(PENDING)` + `OrderItem`, and cannot produce a ₦0, unshippable or duplicated order |
| **N3** | Thu 27 – Mon 31 Aug | **Inventory + payments.** Inventory seed, `POST /payments/init`, raw-body webhook, HMAC guard, the one transaction | A Paystack test card drives `PENDING → PAID`, stock drops exactly once, cart empties |
| **Buffer** | Tue 1 – Sun 6 Sep | Webhook overflow, order read endpoints, deploy, re-run verification against the live URL | A real Paystack test payment succeeds against the deployed URL |

### Rules that keep the date real

- **One milestone at a time.** Half-done N3 plus half-done deploy is worth nothing; N3 alone is worth
  a lot.
- **Hard checkpoint Sat 29 Aug.** If the webhook isn't moving orders to `PAID` by then, stop adding
  scope. Deploy what works and finish the webhook in the buffer week. The buffer exists for exactly
  this — that's why it isn't holding features.
- **N3 is the heaviest week and it's short (5 days).** The Fastify plan gave the webhook a full week.
  It fits here only because you've already done the thinking once. If N2 slips, take the time out of
  the *order read endpoints*, never out of the webhook.
- Anything not in the table is v2. Write it in the parked list and move on.

---

## Verification

How you'll know payments actually work. Run these once N3 lands, then again against the deployed URL.
**These four tests are the real curriculum.**

1. **Happy path.** Add to cart → checkout → init → pay with a Paystack test card → confirm the
   webhook fired. Assert: order `PAID`, stock down by exactly the quantity ordered, cart empty,
   `Payment` row written with the provider reference.
2. **Replay.** Re-send the identical webhook payload. Assert **nothing changed** — stock did not drop
   twice. This is the test that proves idempotency works.
3. **Tampering.** Send a webhook with a bad signature (must be rejected), then one with a valid
   signature but the wrong amount (must be rejected; order stays `PENDING`). If either passes, you
   have a free-money bug.
4. **Oversell.** Set stock to 1 and fire two payment confirmations concurrently. Exactly one order
   becomes `PAID`; the other fails cleanly and stock never goes negative. This is the hardest and most
   valuable thing in the project — watch what your transaction actually does.

**Nest makes this cheaper than Fastify did.** `test/app.e2e-spec.ts` and supertest are already
scaffolded, and `Test.createTestingModule()` lets you swap a real provider for a fake one. Tests 2 and
3 are pure HTTP calls with a crafted body and signature header — they don't need Paystack at all, so
they're the two worth automating first.

Worth doing once for the lesson: kill the server between payment and webhook, and watch the order
strand in `PENDING` with the money gone. That stranded row is exactly what a reconciliation job exists
to repair — which is why it's top of the v2 list.

---

## Status board

_Update this at the end of every session — even a bad one. Two minutes here is the entire fix for
losing the thread._

**Done**
- Nothing yet. Repo is a bare `nest new` scaffold.

**In progress**
- N1 — foundations + auth. See the checklist in [NEST-GUIDE.md](NEST-GUIDE.md) Part D.

**Next**
- N2 Sanity + cart + checkout → N3 inventory + payments → buffer: read endpoints + deploy

**Parked (v2 — deliberately not doing these now)**
- Frontend wiring · reconciliation job · order expiry · confirmation emails · cancellation and
  refunds · admin status transitions · live Sanity→Postgres inventory sync · stock reservations ·
  rate limiting · Swagger docs

---

## Known limitations

Named on purpose. An unnamed gap is a bug; a named one is a decision. All carried over from the
Fastify build — the port doesn't change any of them.

- **No stock reservations.** Stock is decremented on payment confirmation, not held at checkout. Two
  customers can both reach the Paystack page for the last unit; the second one's payment will fail the
  conditional decrement and needs a refund. The correct fix is a reservation with a TTL — that's v2.
- **No reconciliation.** If the server is down when the webhook arrives, the order strands in
  `PENDING` with the customer's money taken. Nothing repairs that automatically yet.
- No order expiry, so abandoned `PENDING` orders live forever.
- No confirmation email — the customer has no receipt.
- `subtotal` and `total` are always equal: no shipping fees, no tax, no discount codes.
- No guest checkout. Carts are keyed by `userId`.

---

## Issues carried over from the Fastify build

These were found in the Fastify code. Fix them **in the port** rather than reproducing them.

- ⚠️ **`DECISIONS.md` 005 is still open: is Sanity's `productPrice` naira or kobo?**
  **Resolve this in N3 before writing `POST /payments/init`.** If it's naira, a ×100 conversion is
  needed and every Fastify order total is off by two orders of magnitude. A silent ×100 error is the
  classic first-payment bug. Check the Sanity data, decide, write the answer down.
- **The fake refresh token.** `loginUser` returned the access token *as* the refresh token — refresh
  wasn't implemented, it just looked like it was. Here: either implement refresh properly, or don't
  return the field at all. Don't ship the lie twice.
- **Hardcoded port.** Fastify hardcoded 4000. The Nest scaffold already reads `process.env.PORT` —
  route it through `ConfigService` in N1 and it's fixed for free.
- **`dotenv` wasn't in dependencies** and resolved transitively. `@nestjs/config` removes the problem
  entirely.
- **The partial unique index.** One-pending-order-per-user is enforced by
  `CREATE UNIQUE INDEX … ON "Order" ("userId") WHERE status = 'PENDING'`, hand-written because
  Prisma's schema language can't express a filtered index. **Re-create it as a raw SQL migration here,
  and read the SQL of every future generated migration** — Prisma can't see this index in
  `schema.prisma` and will try to drop it.
- **The P2002 catch around `order.create`.** The losing side of a concurrent checkout must get a 409,
  not a 500. Note the Fastify finding: Prisma 7.8 with the `PrismaPg` adapter reports **no
  `meta.target`**, so the check had to narrow on `meta.modelName === "Order"` — unambiguous only while
  `Order` has exactly one unique constraint. **Re-verify this behaviour on whatever Prisma version you
  install here** rather than assuming it carries over.
- **Sanity doesn't enforce that a discounted product has a discount price.** A product can be saved
  with `discountStatus: true` and no `discountPrice`, so a sale badge shows and the customer is charged
  full price. Keep the backend guard (fall back to `productPrice`, log a warning) regardless of whether
  the Sanity schema rule gets added — the rule only validates on save and won't touch existing docs.

---

## Further reading

- [NEST-GUIDE.md](NEST-GUIDE.md) — Fastify → Nest concept map and the per-milestone checklists
- The Fastify repo's `DECISIONS.md` — why things are the way they are. **Still authoritative.**
- The Fastify repo's `JOURNAL.md` — the running learning log. Keep appending to it; one log, not two.
