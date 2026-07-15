# Functionality Documentation — E-commerce Ordering & Payment API

A complete reference of every endpoint and cross-cutting facility. Big-picture design: **[ARCHITECTURE.md](ARCHITECTURE.md)** · setup: **[README.md](README.md)** · interactive docs: **`GET /api/docs`** (Swagger UI).

Base URL: `http://localhost:5000` (configurable via `PORT`). All module routes are mounted under **`/api`**.

**Conventions used below** — every success response is wrapped in `{ success, message, data, meta? }` (meta on paginated lists: `{ page, limit, total }`); every error is `{ success:false, message, errorSources[] }` (+ `stack` in development). All list endpoints accept `page`, `limit`, `sortBy`, `sortOrder`. **All money values are integer minor units** (cents/poisha): `129999` = $1,299.99. Enum values are lowercase per the assessment spec: order `pending|paid|canceled`, payment `pending|success|failed`, provider `stripe|bkash`, product `active|inactive`.

---

## Table of Contents

1. [Auth & User Module](#1-auth--user-module)
2. [Category Module](#2-category-module)
3. [Product Module](#3-product-module)
4. [Order Module](#4-order-module)
5. [Payment Module](#5-payment-module)
6. [Middlewares](#6-middlewares)
7. [Error Handling](#7-error-handling)
8. [Shared Utilities & Helpers](#8-shared-utilities--helpers)
9. [Database Layer & Seeding](#9-database-layer--seeding)
10. [Testing](#10-testing)
11. [Status Code Summary](#11-status-code-summary)

---

## 1. Auth & User Module

`src/app/modules/user/` (registration) and `src/app/modules/auth/` (sessions, passwords, OAuth). Registration defaults new accounts to role **CUSTOMER**; the seeder creates the ADMIN.

### 1.1 `POST /api/users/register` — Register (step 1)

- **Auth:** none. **Body:** `fullName` (2–100), `email`, `mobileNumber` (min 10), `password` (min 8).
- Normalizes email; **409** if a _verified_ user holds the email or mobile; unverified re-registrations update in place. Stores a 6-digit OTP (15 min) and emails it (`EMAIL_VERIFICATION_TEMPLATE`). In non-production, if mail is unconfigured or SMTP fails, the OTP is logged at `debug` level instead (set `LOG_LEVEL=debug`).
- **200:** `{ message, email }`

### 1.2 `POST /api/users/verify-registration` — Verify OTP (step 2)

- **Auth:** none. **Body:** `email`, `otp` (6 digits).
- **404** unknown user; **400** already verified or invalid/expired OTP. On success sets `isVerified`, clears the OTP, issues a JWT (`{ id, email, role }`), and sets the httpOnly `token` cookie (7d, `secure` in production, `sameSite: lax`).
- **201:** `{ user: { id, fullName, email, mobileNumber, role, createdAt }, token }`

### 1.3 `POST /api/users/resend-registration-otp`

- **Auth:** none. **Body:** `email`. **404** unknown / **400** already verified; otherwise fresh 15-minute OTP re-sent. **200.**

### 1.4 `POST /api/auth/login`

- **Auth:** none. **Body:** `email`, `password`.
- **404** unknown email (non-revealing) · **403** not ACTIVE or not verified · **400** Google-only account · **401** wrong password. Success returns `{ token, user }` through `SAFE_USER_SELECT` (never `password`, OTPs, or `googleId`) and sets the `token` cookie.

### 1.5 `POST /api/auth/logout` — clears the cookie. **200.**

### 1.6 `GET /api/auth/me` — **Auth:** any role. Profile via `SAFE_USER_SELECT`. **200 / 401 / 404.**

### 1.7 `PUT /api/auth/change-password`

- **Auth:** any role. **Body:** `oldPassword`, `newPassword` (min 8). **400** wrong current password or Google-only account. **200.**

### 1.8 Forgot-password OTP flow

- `POST /api/auth/forgot-password` `{ email }` → 6-digit OTP, 15 min, emailed (`PASSWORD_RESET_TEMPLATE`). **200 / 404.**
- `POST /api/auth/resend-otp` `{ email }` → fresh OTP. **200 / 404.**
- `POST /api/auth/verify-otp` `{ email, otp }` → validates; on success shrinks remaining validity to 5 minutes for the reset step. **200 / 400.**
- `POST /api/auth/reset-password` `{ email, otp, newPassword, confirmPassword }` (schema enforces match) → re-validates OTP, saves the bcrypt hash, clears the OTP so it can't be replayed. **200 / 400 / 404.**

### 1.9 Google OAuth

- `GET /api/auth/google` → `{ authUrl }` (scopes profile+email, `prompt: consent`).
- `GET /api/auth/google/callback?code=…` → exchanges the code, verifies the ID token, then links by `googleId`, links by email (marks verified), or creates a new pre-verified `GOOGLE` user; **403** if not ACTIVE; sets the `token` cookie and redirects to `{FRONTEND_URL}/auth/callback` (errors → `/auth/error?message=…`).

---

## 2. Category Module

`src/app/modules/category/` — hierarchical categories (self-referencing `parentId`), class-based `CategoryService`, Redis-cached tree, and the DFS utilities in [category.tree.ts](src/app/modules/category/category.tree.ts) (design requirement 2.2.5).

### 2.1 `GET /api/categories` — flat list

- **Auth:** none. **Query:** pagination + `searchTerm` (name/slug, case-insensitive) + `parentId`. Excludes soft-deleted. **200** with meta.

### 2.2 `GET /api/categories/tree` — full tree

- **Auth:** none. Served from Redis key `category:tree` (TTL `CATEGORY_TREE_TTL`, default 3600s); on cache miss builds the forest from one `findMany` via `buildCategoryTree` and stores it; on Redis failure logs one warning and serves from the DB (no crash). Cache hit/miss is logged. **200:** array of `CategoryTreeNode` (`id, name, slug, description, parentId, children[]`).

### 2.3 `GET /api/categories/:id` — details with live children and `_count.products`. **200 / 404.**

### 2.4 `POST /api/categories` — create (**ADMIN**)

- **Body:** `name` (required), `slug?` (kebab-case; auto-generated from name), `description?`, `parentId?`.
- **404** parent missing/deleted · **409** duplicate slug (Prisma P2002 funnel). Invalidates the tree cache. **201.**

### 2.5 `PATCH /api/categories/:id` — update (**ADMIN**)

- Re-parenting is **cycle-guarded**: walking ancestors from the new parent must never reach the category itself → **400** "would create a cycle". Invalidates the tree cache. **200 / 400 / 404.**

### 2.6 `DELETE /api/categories/:id` — soft delete (**ADMIN**)

- Blocked with **409** while the category has non-deleted children or products (explicit guard instead of cascades). Sets `isDeleted` + `deletedAt`, invalidates the tree cache. **200.**

### 2.7 DFS utilities (grading exhibit)

`buildCategoryTree(rows)` — adjacency list → forest in two O(n) passes (orphans of soft-deleted parents become roots). `dfsFindNode(roots, id)` and `dfsCollectSubtreeIds(roots, rootId)` — **iterative, stack-based depth-first search** (no recursion: a 20,000-node chain is covered by a test). Consumers: product subtree filtering, recommendations, `CategoryService.getSubtreeIds`.

---

## 3. Product Module

`src/app/modules/product/` — class-based `ProductService`. Public reads use `optionalAuth`: anonymous/customer callers see **active, non-deleted** products only; a valid ADMIN token widens visibility.

### 3.1 `GET /api/products` — list

- **Auth:** none (optionalAuth). **Query:** pagination, `searchTerm` (name/sku/description), `categoryId` — **expanded via DFS to the whole category subtree**, `status` (effective for admins), `minPrice`/`maxPrice` (integer minor units). Unknown `categoryId` → empty result. **200** with meta.

### 3.2 `GET /api/products/:id` — details (+ category summary). Inactive/deleted → **404** for non-admins. **200 / 404.**

### 3.3 `GET /api/products/:id/recommendations` — related products (2.2.5)

- **Auth:** none. **Query:** `limit` (default 10, max 50).
- Algorithm: product's category → `dfsCollectSubtreeIds` → active products in the subtree (excluding the product); if short of `limit`, widen once to the **parent category's subtree** (sibling categories) via DFS. **200 / 404** (unknown or inactive product).

### 3.4 `POST /api/products` — create (**ADMIN**)

- **Body:** `name`, `sku` (unique; letters/digits/hyphen/underscore), `description?`, `price` (**integer** minor units — floats rejected by validation), `stock?` (default 0), `status?` (default `active`), `categoryId`.
- **404** category missing · **409** duplicate sku. **201.**

### 3.5 `PATCH /api/products/:id` (**ADMIN**) — partial update, category re-validated when changed. **200 / 404.**

### 3.6 `DELETE /api/products/:id` (**ADMIN**) — soft delete. **200 / 404.**

---

## 4. Order Module

`src/app/modules/order/` — class-based `OrderService` plus the **pure** arithmetic in [order.utils.ts](src/app/modules/order/order.utils.ts) (design requirement 2.2.3).

### 4.1 `POST /api/orders` — create

- **Auth:** any authenticated user. **Body:** `{ items: [{ productId, quantity ≥ 1 }] }` — _nothing else_; client-sent prices are ignored by design.
- In one transaction: duplicate `productId`s merged by summing quantities → every product must exist, be `active`, and have `stock ≥ quantity` (else **400/404**) → unit prices snapshotted from the DB → `subtotal = price × quantity`, `totalAmount = Σ subtotals` (integer math; same input ⇒ same output) → order + items inserted with `currency = DEFAULT_CURRENCY`. **Stock is NOT decremented here** — only successful payment settlement reduces stock (2.1.6).
- **201:** order with items (product name/sku included) and payments (empty).

### 4.2 `GET /api/orders/my` — own orders, paginated, with items + payments. **200.**

### 4.3 `GET /api/orders/:id` — owner or ADMIN; foreign orders return **404** (existence not leaked). **200 / 404.**

### 4.4 `GET /api/orders` (**ADMIN**) — all orders; filters `status`, `userId`. **200.**

### 4.5 `PATCH /api/orders/:id/cancel` — owner (or ADMIN)

- Only `pending` orders (**400** otherwise). **409** while a `pending` payment exists — resolve it first via `POST /api/payments/stripe/verify` or `POST /api/payments/bkash/query/:transactionId` (they settle stale payments), then retry. **200:** status `canceled`.

---

## 5. Payment Module

`src/app/modules/payment/` — class-based `PaymentService` + the strategy layer in `strategies/` (design requirement 2.2.4: [PaymentStrategy](src/app/modules/payment/strategies/payment.strategy.ts) interface, `StripeStrategy`, `BkashStrategy` + `BkashClient`, `PaymentStrategyFactory`). Order logic never touches provider SDKs; **adding a provider requires zero edits to order code**.

Providers are opt-in: `STRIPE_ENABLED` / `BKASH_ENABLED` env flags gate credentials (fail-fast when enabled, boot fine when not; initiate returns **400** for a disabled provider).

### 5.1 `POST /api/payments/initiate`

- **Auth:** order owner (or ADMIN). **Body:** `{ orderId, provider: "stripe" | "bkash" }`.
- Guards: **404** foreign/unknown order · **400** order not `pending` · **409** order already has a `success` payment · **400** any item no longer active or in stock (re-validation at payment time, 2.1.6).
- Creates the provider payment (metadata carries `orderId` + pre-generated `paymentId`), stores the Payment row (`transaction_id` = Stripe `pi_…` / bKash `paymentID`, status `pending`, full provider payload in `raw_response`).
- **201:** `{ paymentId, orderId, provider, amount, currency, … }` + `clientSecret` (Stripe) or `bkashURL` (bKash — redirect the payer there).

### 5.2 `POST /api/payments/stripe/webhook`

- **Auth:** none — authenticated by **signature**: the route receives the **raw body** (`express.raw` mounted before `express.json` in `app.ts`) and verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET` (**400** on mismatch). Exempt from rate limiting.
- Handles `payment_intent.succeeded` → settle success, and `payment_intent.payment_failed` → payment `failed` (order stays `pending`, retry possible). Other event types and unknown transaction ids are acknowledged without action. **Idempotent:** an already-settled payment ignores duplicates (no double stock decrement). **200.**

### 5.3 Settlement (internal invariant — `PaymentService.settle`)

On success, in **one transaction**: for every order item a conditional decrement `UPDATE products SET stock = stock - qty WHERE id = ? AND stock >= qty` with the affected count checked; payment → `success`; order → `paid`. Any shortfall rolls back all decrements; the payment is then recorded `success` with `raw_response.anomaly = STOCK_SHORTFALL_AFTER_PAYMENT`, the order stays `pending`, and an error-level log fires — the documented **manual refund path**.

### 5.4 `POST /api/payments/stripe/verify`

- **Auth:** payment owner/ADMIN. **Body:** `{ transactionId }` (the `pi_…` id). Retrieves the PaymentIntent from Stripe, maps `succeeded→success / canceled→failed / else pending`, runs the same idempotent settlement, returns the synced payment. The spec's "confirm" step and the webhook-less demo path. **200 / 404.**

### 5.5 `GET /api/payments/bkash/callback?paymentID=…&status=…`

- **Auth:** none (bKash redirects the payer's browser). `status=success` → server-side **execute**; `statusCode "0000"` + `Completed` settles success (bKash `trxID` preserved inside `raw_response`); anything else, `failure`, or `cancel` → payment `failed`. Always responds **302** to `{FRONTEND_URL}/payment/result?status=…&orderId=…&paymentId=…` — never a raw error to the payer. Exempt from rate limiting.

### 5.6 `POST /api/payments/bkash/query/:transactionId`

- **Auth:** payment owner/ADMIN. Queries bKash payment status (`Completed→success / Initiated→pending / else failed`), settles idempotently — the recovery path when the payer never returned from the checkout. **200 / 404.**

### 5.7 Reads

- `GET /api/payments/my` — own payments with order summary, paginated. **200.**
- `GET /api/payments/:id` — owner or ADMIN. **200 / 404.**
- `GET /api/payments` (**ADMIN**) — all payments; filters `status`, `provider`, `orderId`. **200.**

### 5.8 bKash client (`strategies/bkash.client.ts`)

Tokenized-checkout wrapper (axios, base URL `BKASH_BASE_URL`): grant token (headers `username`/`password`, body `app_key`/`app_secret`) cached ~55 min in Redis `bkash:token` with in-memory fallback; create (`mode "0011"`, `intent "sale"`, `currency "BDT"`, decimal-string amount, `merchantInvoiceNumber = orderId`, `callbackURL`); execute; payment status query. Headers `Authorization: <id_token>` + `X-APP-Key`.

---

## 6. Middlewares

| Middleware                       | Behavior                                                                                                                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth(...roles)`                 | Token from Bearer header / `token` cookie / `x-auth-token`; verifies JWT; **re-reads the user from the DB** each request (deleted → 401, BLOCKED/SUSPEND → 403); optional role whitelist (403); attaches `req.user = { id, email, role }` |
| `optionalAuth`                   | Runs `auth()` but swallows failures — endpoint stays public, valid admin tokens widen visibility (product reads)                                                                                                                          |
| `validateRequest(schema)`        | `schema.parseAsync(req.body)`; ZodErrors → 400 with per-field `errorSources`                                                                                                                                                              |
| `authLimiter` / `paymentLimiter` | 100 req / 15 min / IP on `/api/auth/*` and `/api/payments/*`; envelope-shaped 429; **skips** `/stripe/webhook` + `/bkash/callback`                                                                                                        |
| `GlobalErrorHandler`             | See §7; logs every error via pino with method/path/status                                                                                                                                                                                 |
| Raw-body mount                   | `express.raw({ type: "application/json" })` on `/api/payments/stripe/webhook`, registered **before** `express.json()` — signature verification needs exact bytes                                                                          |

---

## 7. Error Handling

Single funnel (`GlobalErrorHandler`): `ZodError` → 400 + field list · `ApiError(statusCode, message)` → as thrown · Prisma **P2002** → 409 duplicate (field named) · **P2025** → 404 · **P2003/P2014** → 400 · `PrismaClientValidationError` → 400 · Syntax/Type errors → 400 · anything else → 500. `stack` only when `NODE_ENV=development`. Controllers never try/catch — `catchAsync` forwards rejections.

---

## 8. Shared Utilities & Helpers

| Utility                                | Purpose                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [money.ts](src/shared/money.ts)        | `toMinorUnits(12.99) → 1299`; `toMajorUnitsString(57996) → "579.96"` (throws on non-integers). The **only** place money formats convert, used exclusively by payment strategies |
| `logger.ts`                            | pino singleton (`LOG_LEVEL`, default `info`); JSON structured logs                                                                                                              |
| `redis.ts` (`app/lib`)                 | `redisGet/redisSet/redisDel` never throw — warn once, return null/false, auto-reconnect after 30s cooldown; Redis is optional in dev                                            |
| `catchAsync` / `sendResponse` / `pick` | async controller wrapper · uniform success envelope · query whitelist                                                                                                           |
| `emailSender`                          | Gmail SMTP; returns `{ sent }`; unconfigured → skip+warn; transport failure → throw in production, degrade + warn otherwise                                                     |
| `paginationHelper`                     | `page/limit/skip/sortBy/sortOrder` with defaults (1/10/createdAt/desc)                                                                                                          |
| `jwtHelpers`                           | sign/verify                                                                                                                                                                     |
| `prisma.ts` (`app/lib`)                | PrismaClient singleton (pg driver adapter); also raises Node's Happy-Eyeballs per-address timeout to 2s — cures spurious `ETIMEDOUT` against remote Postgres (e.g. Neon)        |

---

## 9. Database Layer & Seeding

- Schema and ERD: [ARCHITECTURE.md §3](ARCHITECTURE.md#3-entity-relationship-diagram). Migration history includes `20260710011500_ecommerce_init` (enums, role change, all e-commerce tables, indexes, FKs).
- **Seeder** (`prisma/seed.ts`, hook in `prisma.config.ts`, run `npx prisma db seed`) — **idempotent** (upserts by email/slug/sku): admin from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (default `admin@example.com` / `changeme123`), a 3-level 10-node category tree (electronics → computers/phones → …, fashion → men's/women's), and 17 products across 6 leaf categories with minor-unit prices — including `KEY-003` (stock 0) and `ACC-004` (inactive) as negative-test fixtures.

---

## 10. Testing

`npm test` (Jest ESM + ts-jest + Supertest, 86 tests / 10 suites) · `npm run test:coverage`. The suite provisions an isolated `ecommerce_test` database (see [.env.test.example](.env.test.example)) — creation, `migrate deploy`, truncation in `tests/global-setup.mjs`; a safety check refuses to run against the dev database. Suite breakdown in [ARCHITECTURE.md §9](ARCHITECTURE.md#9-testing-86-tests-10-suites).

---

## 11. Status Code Summary

| Code | When                                                                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200  | Reads, updates, cancels, webhook acks, syncs                                                                                                                            |
| 201  | Registration verified, category/product/order/payment created                                                                                                           |
| 302  | Google OAuth + bKash callback redirects                                                                                                                                 |
| 400  | Validation failures, invalid/expired OTP, non-pending order operations, insufficient stock, inactive product, disabled provider, invalid webhook signature, tree cycles |
| 401  | Missing/invalid token, wrong login password                                                                                                                             |
| 403  | Unverified email, blocked/suspended account, role denied                                                                                                                |
| 404  | Unknown resources — including foreign orders/payments (ownership never leaks existence)                                                                                 |
| 409  | Duplicate email/mobile/slug/sku, category delete with children/products, cancel with in-flight payment, second payment on a paid order                                  |
| 429  | Rate limit exceeded                                                                                                                                                     |
| 500  | Unexpected errors (logged, stack in dev only)                                                                                                                           |
