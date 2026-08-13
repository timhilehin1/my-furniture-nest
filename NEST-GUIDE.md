# Fastify → NestJS: the guide

You are not learning a new problem. You already solved this domain once. You are learning a new
**shape** for the same solution.

This document is in five parts:

- **[Part A](#part-a--the-concept-map)** — the concept map. Every Fastify thing you built, and its Nest equivalent.
- **[Part B](#part-b--the-oop-ideas-nest-actually-leans-on)** — the OOP ideas Nest leans on, continued from your journal.
- **[Part C](#part-c--day-one-config-decisions)** — day-one config decisions, before any feature code.
- **[Part D](#part-d--milestone-checklists)** — the milestone checklists. This is the part you work from.
- **[Part E](#part-e--where-to-look-things-up)** — where to look things up.

Code fragments below are **shapes, not implementations**. They show you what the file looks like;
you write what goes inside.

---

## Part A — the concept map

| What you built in Fastify | Nest equivalent | The idea |
|---|---|---|
| A route file / plugin | `@Module` + `@Controller` | A module is a bag of related things. The controller only speaks HTTP. |
| `server.register(plugin)` | `imports: [SomeModule]` | Wiring is declarative and typed instead of imperative. |
| Importing `prisma` wherever you needed it | `@Injectable()` provider + constructor injection | Nest builds the object graph for you. **This is the single biggest idea in the framework.** |
| `preHandler` auth hook | `CanActivate` guard + `@UseGuards()` | Same job — run before the handler, reject or continue — but composable per-route, per-controller or globally. |
| `authorize` role middleware | `RolesGuard` + `@Roles()` (`SetMetadata` + `Reflector`) | The decorator attaches metadata to the route; the guard reads it back at request time. |
| `request.user` | `@CurrentUser()` via `createParamDecorator` | Type-safe, and the controller signature documents its own requirements. |
| Zod schema in `schema.body` | DTO class + global `ValidationPipe` | The class **is** both the runtime check and the TypeScript type — no separate `interface`, and no `as CheckoutInput` cast that nothing enforces. |
| `AppError` + your custom subclasses | Built-in `HttpException` subclasses | `BadRequestException`, `NotFoundException`, `ConflictException`, `UnauthorizedException` are already what you hand-wrote. You keep the inheritance instinct — Nest just ships the base classes. |
| `setErrorHandler` | Global `ExceptionFilter` | One class, registered once. This is where the Prisma `P2002 → 409` mapping goes. |
| `dotenv/config` at the top of `server.ts` | `ConfigModule.forRoot({ isGlobal: true })` + `ConfigService` | Validated **at boot**, so a missing var fails on startup, not at 2am. |
| Raw body for the webhook | `NestFactory.create(AppModule, { rawBody: true })` → `req.rawBody` | Nest supports this natively. The HMAC must run against raw bytes — parsed-then-restringified JSON will not match. |
| `src/lib/util.ts` → `buildCart` | A method on `CartService` | Services hold logic, controllers hold HTTP. That split *is* the framework. There is no `lib/util.ts` in a Nest app. |
| `src/lib/prisma.ts` singleton | `PrismaService extends PrismaClient` in a `@Global()` `PrismaModule` | Nest manages the lifecycle: `onModuleInit` connects, `enableShutdownHooks` disconnects. |
| Sanity client created at import time | `SanityService` | One place `@sanity/client` is touched. Everything else injects the service. |
| `tsx watch` | `nest start --watch` | — |
| `fastify.route({ method, url, handler })` | `@Post('cart') add(...) {}` | The decorator *is* the route registration. |

### The one-paragraph version

In Fastify you wrote functions and wired them up by hand. In Nest you write **classes**, tag them with
decorators so the framework knows what they are, and declare in a **module** which ones belong
together. Nest then constructs everything for you, in the right order, and hands each class the things
it asked for in its constructor. That handing-over is dependency injection, and everything else in the
framework is built on top of it.

### Shapes

<details>
<summary><b>Auth hook → guard</b></summary>

```ts
// Fastify: attach a preHandler to routes that need it
// Nest:
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean { /* verify, attach user, return true/false */ }
}

// then, on the controller or the route
@UseGuards(JwtAuthGuard)
@Get('profile')
profile(@CurrentUser() user: JwtUser) { ... }
```
Returning `false` (or throwing `UnauthorizedException`) stops the request. Same as your hook.
</details>

<details>
<summary><b>Zod schema → DTO</b></summary>

```ts
// Fastify: schema.body = checkoutSchema, then `as CheckoutInput` in the controller
// Nest:
export class CheckoutDto {
  @IsString() @IsNotEmpty() shippingAddress: string;
  @IsEmail() email: string;
}

@Post('checkout')
checkout(@Body() dto: CheckoutDto) { ... }   // already validated, already typed
```
The global `ValidationPipe` does the work. `whitelist: true` strips unknown keys;
`forbidNonWhitelisted: true` rejects them instead. Pick one and be consistent.
</details>

<details>
<summary><b>Error handler → exception filter</b></summary>

```ts
// Fastify: app.setErrorHandler((err, req, reply) => ...)
// Nest:
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    // P2002 → 409. Log the raw message, never return it — it names tables and columns.
  }
}
```
</details>

---

## Part B — the OOP ideas Nest actually leans on

Your journal already worked out classes, constructors, `super()` and inheritance. Here's where those
land in Nest, plus the two or three ideas that go beyond them.

**1. Constructor injection is the shorthand you already found.**
You wrote this in your journal:

```ts
class Car {
  constructor(public color: string) {}
}
```

That parameter-property shorthand — declare and assign in one go — is exactly what every Nest service
uses:

```ts
@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private sanity: SanityService,
  ) {}
}
```

You never write `new CartService(...)`. Nest reads the constructor's parameter **types**, finds those
providers, and constructs the object for you. That's the container.

**2. Decorators are metadata, not magic.**
`@Injectable()` doesn't change what the class does — it records "this class can be injected" in a
metadata table. `@Controller('cart')` records a route prefix. The reason injection-by-type works at all
is `emitDecoratorMetadata: true` in `tsconfig.json`: it makes TypeScript emit the parameter types into
the compiled JavaScript, where the framework can read them at runtime. Turn that flag off and Nest
stops working — that's how un-magical it is.

**3. Providers are singletons by default.**
There is **one** `CartService` instance for the entire application, shared by every request. So
services must be stateless: no request data on `this`. Anything request-specific arrives as a method
argument.

**4. Composition over inheritance — for services.**
Your `extends AppError` instinct was correct, and it stays correct for **exceptions**. It is wrong for
services. A service doesn't inherit from another service; it *receives* it in its constructor. If you
find yourself wanting `class OrdersService extends CartService`, what you actually want is
`constructor(private cart: CartService)`.

**5. Modules are boundaries.**
A provider is only injectable in modules that import its module — and only if that module `exports` it.
This is real encapsulation, and it's the part that trips people up first: *"Nest can't resolve
dependencies of the CartService (?)"* almost always means you forgot to `exports:` the provider, or
forgot to `imports:` the module.

`@Global()` opts out of that. `PrismaModule` is the one place it's worth it, because literally
everything needs it. Resist using it anywhere else — global modules make the dependency graph
invisible, which is the thing you came here to learn to read.

**6. The DI container is why testing gets easy.**
Because `CartService` asks for a `SanityService` rather than importing one, a test can hand it a fake:

```ts
Test.createTestingModule({ providers: [CartService, { provide: SanityService, useValue: fakeSanity }] })
```

Nothing was mocked at the module-loader level. You just passed a different object. That is the entire
payoff of DI, and it's why the framework insists on it.

---

## Part C — day-one config decisions

Make these **before** writing feature code. All of them are cheap now and painful once 40 files exist.

- [ ] **Turn on `"strict": true`** in `tsconfig.json`. The scaffold ships only `strictNullChecks`, with
      `noImplicitAny: false` and `strictBindCallApply: false`. Flip the lot now. Retrofitting strict
      mode onto a finished app is a bad weekend.
- [ ] **Add a path alias.** `"paths": { "@/*": ["src/*"] }` in `tsconfig.json`, **plus** the matching
      `moduleNameMapper` in *both* Jest configs — the unit config in `package.json` uses
      `rootDir: "src"`, and `test/jest-e2e.json` uses `rootDir: "."`. If you only do one, e2e tests
      break later and it won't be obvious why.
- [ ] **Keep the Express adapter** and `module: nodenext` (CommonJS emit). Don't switch to
      `@nestjs/platform-fastify` — every Nest doc, recipe and Stack Overflow answer assumes Express, and
      you're here to learn Nest, not to fight the scaffold.
- [ ] **Know that type-aware linting is already on.** `eslint.config.mjs` uses
      `recommendedTypeChecked`, so untyped Sanity responses will trip `no-unsafe-assignment` /
      `no-unsafe-member-access` everywhere. **Fix this once, at the boundary:** give `SanityService`
      methods real return types. Don't scatter `eslint-disable` comments through the codebase.
- [ ] **Delete the scaffold's placeholders** when the real modules land: `app.controller.ts`,
      `app.service.ts`, `app.controller.spec.ts`. Keep `app.module.ts` and `main.ts`.
- [ ] **Make the first commit before anything else.** This repo has zero commits. Commit the untouched
      scaffold first, so your very first diff shows exactly what you added.

---

## Part D — milestone checklists

Work top to bottom. **Do not start the next milestone until the stop-and-verify step passes.**

Time estimates are honest, not optimistic. If a box is taking twice its estimate, that's information —
write it in the journal.

---

### N1 — Foundations + auth · Thu 13 – Wed 19 Aug · ~5 hrs

**The Nest concept this milestone teaches: dependency injection and modules.** Everything else is
scaffolding around that one idea.

**Setup (~45 min)**
- [ ] Commit the untouched scaffold. Do Part C's config changes. Commit again.
- [ ] Install N1 dependencies (see README).
- [ ] `npx prisma init`, then **copy `schema.prisma` from the Fastify project wholesale** — models,
      enums, the lot. Don't retype it.
- [ ] Create a new empty database, point `DATABASE_URL` at it, `npx prisma migrate dev --name init`.
- [ ] Re-create the partial unique index as a raw SQL migration:
      `CREATE UNIQUE INDEX ... ON "Order" ("userId") WHERE status = 'PENDING'`. Do it now while you
      remember; it's invisible to Prisma and easy to forget forever.

**Prisma + config (~1 hr)**
- [ ] `nest g module prisma && nest g service prisma`
- [ ] `PrismaService extends PrismaClient implements OnModuleInit` — `onModuleInit()` calls
      `this.$connect()`.
- [ ] Mark `PrismaModule` `@Global()` and `exports: [PrismaService]`.
- [ ] `ConfigModule.forRoot({ isGlobal: true, validate })` in `app.module.ts`, with a validation
      function that throws on a missing var.
- [ ] `main.ts`: read the port from `ConfigService`, register the global `ValidationPipe`
      (`whitelist: true, transform: true`).
- [ ] **Checkpoint:** `npm run start:dev` boots, and deliberately removing `JWT_SECRET` from `.env`
      makes it fail *at startup* with a clear message.

**Users + auth (~2.5 hrs)**
- [ ] `nest g resource users` and `nest g module auth && nest g controller auth && nest g service auth`
      (answer "REST API" / no CRUD entry points where prompted).
- [ ] `UsersService`: `findByEmail`, `create`, `findById`. Injects `PrismaService`.
- [ ] `RegisterDto`, `LoginDto` with `class-validator` decorators.
- [ ] `AuthService`: bcrypt hash on register, compare on login, `JwtService.signAsync` for the token.
      **Injects `UsersService` — it does not import Prisma directly.**
- [ ] `JwtModule.registerAsync` in `AuthModule`, pulling secret + expiry from `ConfigService`.
- [ ] `JwtAuthGuard` + `@CurrentUser()` param decorator in `common/`.
- [ ] `GET /profile`, guarded, returning the current user without the password hash.
- [ ] **Decide the refresh-token question now.** Either implement refresh properly, or return only an
      access token. Do not return the access token labelled as a refresh token — that was the Fastify
      bug.

**Errors (~45 min)**
- [ ] Replace your `AppError` subclasses with Nest's built-ins at the throw sites — `NotFoundException`,
      `ConflictException`, `BadRequestException`, `UnauthorizedException`. Nothing to write.
- [ ] `PrismaExceptionFilter`: `P2002` → 409 with a generic message. Log the raw Prisma message; never
      return it (it names tables and columns). Register it globally in `main.ts`.

**🛑 Stop and verify — N1 is done when:**
1. `POST /auth/register` creates a user with a hashed password.
2. `POST /auth/login` returns a token.
3. `GET /profile` with that Bearer token returns the user; without it, 401.
4. Registering the same email twice returns **409**, not 500.
5. **You can explain out loud why `AuthService` is injected into `AuthController` rather than
   imported.** If you can't, re-read Part B before N2 — everything after this compounds on it.

---

### N2 — Sanity + cart + checkout · Thu 20 – Wed 26 Aug · ~5 hrs

**The Nest concept this milestone teaches: services collaborating, and where logic belongs.**

**Sanity (~1 hr)**
- [ ] `nest g module sanity && nest g service sanity`.
- [ ] `SanityService` wraps `@sanity/client`, created with `ConfigService` values. **Give its methods
      real return types** — this is the boundary that stops `no-unsafe-*` lint noise spreading.
- [ ] Port the product query from the Fastify project unchanged.

**Cart (~2 hrs)**
- [ ] `nest g resource cart`.
- [ ] Port `buildCart` as a method on `CartService`. Keep every M1 behaviour:
      - [ ] partitions into `items` + `unavailableItems`, each unavailable entry tagged with a
            `reason` (`"DELETED"` / `"OUT_OF_STOCK"`) — **never 404 the whole cart over one missing product**
      - [ ] `availabilityStatus` checked per item → `OUT_OF_STOCK`
      - [ ] empty cart returns `{ items: [], subTotal: 0, unavailableItems: [] }`, not an error
      - [ ] the discount guard: `discountStatus: true` with no `discountPrice` falls back to
            `productPrice` and logs a warning
- [ ] The five cart routes with DTOs. `addToCart` snapshots `productName` + `imageUrl` (display fields
      only — **never snapshot price on a cart row**).

**Checkout (~2 hrs)**
- [ ] `nest g resource orders`.
- [ ] `CheckoutDto` — `shippingAddress`, `shippingCity`, `shippingState`, `shippingCountry`, `phone`,
      `email`. All required, all frozen onto the `Order`.
- [ ] `OrdersService.checkout` inside `prisma.$transaction`: create `Order(PENDING)` + `OrderItem` rows
      with prices copied in.
- [ ] Carry over every guard, **in the original order**:
      - [ ] unavailable items → 409 **first**
      - [ ] empty cart → 400 **second** (so an all-deleted cart says "review your cart", not the
            misleading "cart is empty")
      - [ ] existing pending order → 409
      - [ ] catch `P2002` around `order.create` → the same 409. **Re-check how your installed Prisma
            version reports the constraint** — the Fastify build found no `meta.target` under the
            `PrismaPg` adapter and had to narrow on `meta.modelName`. Verify, don't assume.

**🛑 Stop and verify — N2 is done when:**
1. `GET /cart` merges Sanity data and returns a subtotal.
2. A cart containing a deleted product still returns 200, with that item in `unavailableItems`.
3. `POST /checkout` on an empty cart returns 400; with an unavailable item, 409.
4. A successful checkout creates one `Order` and N `OrderItem`s with frozen prices and the delivery
   snapshot.
5. Checking out twice in a row returns 409 the second time.

---

### N3 — Inventory + payments · Thu 27 – Mon 31 Aug · ~5 hrs · **the heavy one**

**The Nest concept this milestone teaches: guards for non-auth purposes, raw request access, and
transactions.** The domain content here is the hardest thing in the project.

> **Before anything else — resolve `DECISIONS.md` 005.** Is Sanity's `productPrice` in naira or kobo?
> Paystack charges in **kobo**. If the answer is naira, you need `×100` and the Fastify orders are all
> wrong by two orders of magnitude. **Write the answer into `DECISIONS.md` before you write the init
> endpoint.** A silent ×100 is the classic first-payment bug and it is very hard to spot afterwards.

**Inventory (~1 hr)**
- [ ] `nest g resource inventory`.
- [ ] A one-off seed script: read products from Sanity, upsert an `Inventory` row per product id.
      Run it with `ts-node`; it is not an endpoint.
- [ ] Out-of-stock rejection at checkout (a read check — the *decrement* stays in N3's webhook).

**Payment init (~1.5 hrs)**
- [ ] `nest g resource payments`.
- [ ] `POST /payments/init`: load the order by id **and** `userId`, re-derive the amount from
      `order.total` — **never from the request body** — call Paystack's initialise endpoint, write a
      `Payment` row with the reference, return the authorization URL.
- [ ] **Checkpoint:** the returned URL opens a real Paystack page showing the right amount. If the
      amount is off by 100×, stop and go back to the decision above.

**The webhook (~2.5 hrs — budget all of it)**
- [ ] `main.ts`: `NestFactory.create(AppModule, { rawBody: true })`.
- [ ] `PaystackSignatureGuard`: HMAC-SHA512 of the **raw body** with `PAYSTACK_SECRET_KEY`, compared to
      the `x-paystack-signature` header using a timing-safe compare. Reject → the request never reaches
      the handler.
- [ ] The handler, **in this exact order**:
      1. [ ] signature already verified by the guard, against **raw bytes**
      2. [ ] verify amount **and currency** match the order snapshot — mismatch means do not mark paid
      3. [ ] if the order is already `PAID`, return 200 immediately and change nothing (**idempotency**)
      4. [ ] one `prisma.$transaction`: status → `PAID`, conditional stock decrement
            (`where: { quantity: { gte: n } }`), clear the cart, write/update the `Payment` row
      5. [ ] return 200 fast — slow responses make Paystack retry
- [ ] **No DTO and no `ValidationPipe` on this route.** Validation happens by signature, and a
      transform pipe would fight the raw body.

**🛑 Stop and verify — N3 is done when the four tests in the README's Verification section pass.**
Tests 2 (replay) and 3 (tampering) need no real payment — craft the body and header yourself. Automate
those two; they're the ones that catch free-money bugs.

**Hard checkpoint Sat 29 Aug:** if the webhook isn't moving orders to `PAID` by then, stop. Deploy what
works, finish the webhook in the buffer week. Don't let it eat the deploy.

---

### Buffer · Tue 1 – Sun 6 Sep

Only after N3 is genuinely closed.

- [ ] `GET /orders` — paginated history for the current user.
- [ ] `GET /orders/:id` — **filter by `id` AND `userId`**. Filtering by id alone means any logged-in
      user can read anyone's order.
- [ ] Hosted Postgres, deploy, real webhook URL in the Paystack dashboard.
- [ ] Re-run all four verification tests against the deployed URL.
- [ ] Final journal entry: what Nest made easier than Fastify, and what it made harder.

---

## Part E — where to look things up

The Nest docs, in the order these become relevant. Read the page when you hit the thing, not before.

| When you're on | Read |
|---|---|
| N1 setup | [Providers](https://docs.nestjs.com/providers) → [Modules](https://docs.nestjs.com/modules) — read both properly, once. Everything rests here. |
| PrismaService | [Prisma recipe](https://docs.nestjs.com/recipes/prisma) |
| Config | [Configuration](https://docs.nestjs.com/techniques/configuration) |
| DTOs | [Validation](https://docs.nestjs.com/techniques/validation) + the [class-validator decorator list](https://github.com/typestack/class-validator#validation-decorators) |
| JwtAuthGuard | [Guards](https://docs.nestjs.com/guards) → [Authentication](https://docs.nestjs.com/security/authentication) |
| `@CurrentUser()` | [Custom decorators](https://docs.nestjs.com/custom-decorators) |
| Error mapping | [Exception filters](https://docs.nestjs.com/exception-filters) |
| The webhook | [Raw body](https://docs.nestjs.com/faq/raw-body) |
| Tests | [Testing](https://docs.nestjs.com/fundamentals/testing) — specifically `Test.createTestingModule` and overriding providers |

**When you're stuck on a Nest error rather than a domain problem**, the message is usually literal.
*"Nest can't resolve dependencies of the X (?)"* — the `?` marks which constructor parameter it
couldn't find. Nine times out of ten the fix is an `exports:` on the providing module or an `imports:`
on the consuming one.

---

## One last thing

Keep appending to the Fastify project's `JOURNAL.md` — one log, not two. The interesting entries over
the next three weeks will be the moments where Nest's way felt like more ceremony than Fastify's, and
whether you still thought so a week later. That comparison is the actual thing you're buying by
building it twice.
