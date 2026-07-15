# E-commerce Ordering & Payment System API

REST API for users, categories, products, orders, and payments with **Stripe** (test mode) and **bKash** (tokenized checkout sandbox) — Express 5 + TypeScript (ESM) + Prisma 7 + PostgreSQL + Redis.

- **Design & diagrams (system, ERD, payment sequences):** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Every endpoint documented:** [DOCUMENTATION.md](DOCUMENTATION.md) + live **Swagger UI at `/api/docs`**
- Money is **always integer minor units** (cents/poisha) — `129999` = $1,299.99.

---

## 1. Quick start (local)

Requirements: Node ≥ 20, PostgreSQL, optionally Redis (the app degrades gracefully without it).

```bash
npm install
cp .env.example .env          # fill in at least DATABASE_URL and JWT_SECRET

npm run generate:prisma       # generate the Prisma client
npx prisma migrate deploy     # apply migrations
npx prisma db seed            # admin + 10 categories + 17 demo products (idempotent)

npm run dev                   # http://localhost:5000  ·  docs at /api/docs
```

Smoke test:

```bash
curl http://localhost:5000/                       # landing/health page
curl http://localhost:5000/api/categories/tree     # seeded category tree
# admin login (seeded):
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"changeme123"}'
```

### Demo order flow

1. Register: `POST /api/users/register` → check your inbox — or, with mail unconfigured and `LOG_LEVEL=debug`, read the OTP from the server log.
2. Verify: `POST /api/users/verify-registration` `{ email, otp }` → get a token.
3. Browse: `GET /api/products?categoryId=<computers-id>` (includes subcategories via DFS) · `GET /api/products/:id/recommendations`.
4. Order: `POST /api/orders` `{ "items": [{ "productId": "…", "quantity": 2 }] }` — totals computed server-side.
5. Pay: `POST /api/payments/initiate` `{ orderId, provider: "stripe" | "bkash" }` → `clientSecret` / `bkashURL`.
6. Settlement arrives via the Stripe webhook or bKash callback; check `GET /api/orders/my` — the order flips to `paid` and stock decrements **only now**.

---

## 2. Environment configuration guide

Copy [.env.example](.env.example) → `.env`. Every variable, by group:

| Variable                                     | Required                      | Meaning                                                                                                                                                  |
| -------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                               | **yes**                       | PostgreSQL connection string (Prisma + pg driver adapter)                                                                                                |
| `JWT_SECRET`                                 | **yes**                       | JWT signing secret — the app **refuses to boot** without it                                                                                              |
| `NODE_ENV`                                   | recommended                   | `development` / `production` — gates stack traces, secure cookies, dev OTP logging, email failure behavior                                               |
| `PORT`                                       | no (5000)                     | HTTP port                                                                                                                                                |
| `EXPIRES_IN`                                 | no (`7d`)                     | Access-token TTL                                                                                                                                         |
| `BCRYPT_SALT_ROUNDS`                         | no (12)                       | Password hash cost                                                                                                                                       |
| `WEBSITE_NAME`, `CONTACT_MAIL`               | no                            | Branding for emails/landing page                                                                                                                         |
| `FRONTEND_URL`                               | recommended                   | Redirect target for OAuth + payment result pages                                                                                                         |
| `CORS_ORIGINS`                               | recommended                   | Comma-separated origin whitelist — **add your Vercel domain here** (e.g. `https://your-app.vercel.app`); cookies work cross-origin (`credentials: true`) |
| `REDIS_URL`                                  | no (`redis://localhost:6379`) | Category-tree + bKash-token cache; **optional in dev** — on failure the app logs one warning and falls back to the DB                                    |
| `CATEGORY_TREE_TTL`                          | no (3600)                     | Tree cache TTL, seconds                                                                                                                                  |
| `DEFAULT_CURRENCY`                           | no (`usd`)                    | Currency label stamped on new orders (see §5 note)                                                                                                       |
| `LOG_LEVEL`                                  | no (`info`)                   | Set `debug` in dev to see OTPs when mail is unconfigured                                                                                                 |
| `MAIL_EMAIL`, `MAIL_APP_PASS`                | no                            | Gmail + **App Password** for OTP emails. Unset/failing in dev → flows continue, OTP appears in debug logs; in production send-failures throw             |
| `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL`       | for OAuth                     | Google OAuth 2.0 credentials                                                                                                                             |
| `STRIPE_ENABLED`                             | no (false)                    | Master switch; when `true`, the two keys below become **required at boot**                                                                               |
| `STRIPE_SECRET_KEY`                          | if enabled                    | `sk_test_…` from the Stripe dashboard                                                                                                                    |
| `STRIPE_WEBHOOK_SECRET`                      | if enabled                    | `whsec_…` from `stripe listen` or the dashboard webhook                                                                                                  |
| `STRIPE_CURRENCY`                            | no (`usd`)                    | Currency sent to Stripe                                                                                                                                  |
| `BKASH_ENABLED`                              | no (false)                    | Master switch; when `true`, all bKash vars below are required                                                                                            |
| `BKASH_BASE_URL`                             | if enabled                    | Sandbox: `https://tokenized.sandbox.bka.sh/v1.2.0-beta`                                                                                                  |
| `BKASH_APP_KEY/APP_SECRET/USERNAME/PASSWORD` | if enabled                    | Sandbox merchant credentials                                                                                                                             |
| `BKASH_CALLBACK_URL`                         | if enabled                    | Public URL of `/api/payments/bkash/callback` (ngrok in local dev — §4)                                                                                   |
| `SEED_ADMIN_EMAIL/PASSWORD`                  | no                            | Seeder admin credentials (defaults `admin@example.com` / `changeme123`)                                                                                  |
| Cloudinary / DO Spaces vars                  | no                            | Optional boilerplate file-upload features                                                                                                                |

---

## 3. Stripe test-mode setup

1. Get your test **secret key** (`sk_test_…`) from [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys); set `STRIPE_ENABLED=true`, `STRIPE_SECRET_KEY=…`.
2. **Local webhooks — Stripe CLI (recommended):**
   ```bash
   stripe login
   stripe listen --forward-to localhost:5000/api/payments/stripe/webhook
   ```
   Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET` and restart. Trigger events with `stripe trigger payment_intent.succeeded` or by confirming a real test intent.
3. **Dashboard webhook (deployed or ngrok):** Developers → Webhooks → Add endpoint → `https://<your-host>/api/payments/stripe/webhook`, events `payment_intent.succeeded` + `payment_intent.payment_failed`; use that endpoint's signing secret.
4. Client side: `POST /api/payments/initiate` returns `clientSecret` — confirm with Stripe.js/Elements and test card `4242 4242 4242 4242` (any future expiry/CVC). No frontend? `POST /api/payments/stripe/verify { transactionId }` syncs status straight from Stripe.

## 4. bKash sandbox setup + ngrok

1. Request sandbox credentials from the [bKash developer portal](https://developer.bka.sh/) (tokenized checkout): app key/secret + username/password. Fill the `BKASH_*` vars, `BKASH_ENABLED=true`.
2. bKash must be able to redirect the payer back to you, so the callback needs a **public URL** — use ngrok locally:
   ```bash
   ngrok http 5000
   # e.g. https://ab12cd34.ngrok-free.app
   ```
   Set `BKASH_CALLBACK_URL=https://ab12cd34.ngrok-free.app/api/payments/bkash/callback` and restart. (The same ngrok URL also works for the Stripe dashboard webhook if you're not using the CLI.)
3. Flow: initiate → open the returned `bkashURL` → pay with a sandbox wallet → bKash redirects to the callback → the server **executes** the payment and redirects the payer to `FRONTEND_URL/payment/result?...`. If the payer never returns, `POST /api/payments/bkash/query/:transactionId` reconciles.

## 5. Currency note (documented assumption)

`Order.currency` is a label from `DEFAULT_CURRENCY`. Stripe charges `STRIPE_CURRENCY`; bKash always charges **BDT** — each receives the same numeric minor-unit amount (Stripe as integer, bKash as decimal string). Real multi-currency (FX, per-provider enforcement) is intentionally out of scope for this assessment; production would validate order currency against the provider before initiating.

## 6. Testing

```bash
npm test                # 86 tests: unit + API + webhook (Jest ESM + Supertest)
npm run test:coverage
```

The suite runs against an **isolated database** — it derives `ecommerce_test` from `DATABASE_URL` (creating and migrating it automatically), or uses `DATABASE_URL_TEST` if set ([.env.test.example](.env.test.example)). It truncates that database on startup and refuses to run if it matches your dev URL. Stripe/bKash are never called over the network: strategies are tested with injected fakes, and webhook signatures use Stripe's offline HMAC utilities.

## 7. Docker

```bash
cp .env.docker.example .env.docker    # set at least JWT_SECRET (+ provider keys as needed)
docker compose up --build
```

Brings up **api** (multi-stage image; entrypoint runs `prisma migrate deploy` then `node dist/server.js`), **postgres:16** (host port **5433**), and **redis:7**, with healthchecks and named volumes. Seed from the host:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ecommerce?schema=public npx prisma db seed
```

## 8. Scripts

| Script                                           | Purpose                                         |
| ------------------------------------------------ | ----------------------------------------------- |
| `npm run dev` / `build` / `start`                | tsx watch dev server / compile / run `dist`     |
| `npm test` / `test:coverage`                     | Jest suite / with coverage                      |
| `npm run generate:prisma` / `migrate` / `studio` | Prisma client / `migrate dev` / DB GUI          |
| `npx prisma db seed`                             | Idempotent seeder (admin, categories, products) |
| `npm run generate <name>`                        | Scaffold a new CRUD module                      |
| `npm run lint`                                   | ESLint                                          |
# E-Commerce-Ordering-and-Payment-API
