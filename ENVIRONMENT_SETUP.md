# Environment Configuration & Local ngrok Setup Guide

This guide provides detailed instructions on how to configure your environment variables for the E-commerce Ordering & Payment System API and how to set up `ngrok` for local webhook testing (Stripe and bKash).

## 1. Environment Variables Configuration

To run the project locally, you must create a `.env` file in the root directory. You can use `.env.example` as a template:

```bash
cp .env.example .env
```

### Core Server Configuration

- `NODE_ENV`: Set to `development` for local testing. In `production`, this enforces secure cookies and disables dev-only OTP logging.
- `PORT`: The port the server runs on (e.g., `5000` or `8080`).
- `FRONTEND_URL`: URL of the frontend application (e.g., `http://localhost:3000`). Used for OAuth and payment result redirects.
- `CORS_ORIGINS`: Comma-separated allowed origins (e.g., `http://localhost:3000,http://localhost:3001`). Add your frontend domain here.

### Database & Redis

- `DATABASE_URL`: PostgreSQL connection string. Must be set. Example: `postgresql://user:password@localhost:5432/ecommerce?schema=public`.
- `REDIS_URL`: Redis connection string (e.g., `redis://localhost:6379`). Required for caching category trees and bKash tokens.
- `CATEGORY_TREE_TTL`: TTL for Redis caching in seconds (e.g., `3600`).

### Authentication & Security

- `JWT_SECRET`: Essential for signing access tokens. The app will fail to boot without this.
- `EXPIRES_IN`: Access token expiration (e.g., `7d`).
- `REFRESH_TOKEN_SECRET` / `REFRESH_TOKEN_EXPIRES_IN`: For issuing and verifying refresh tokens.
- `RESET_PASS_TOKEN`, `RESET_PASS_TOKEN_EXPIRES_IN`, `RESET_PASS_LINK`: Configurations for password reset functionality.
- `BCRYPT_SALT_ROUNDS`: Salt rounds for password hashing (e.g., `12`).

### Third-Party Services

#### Google OAuth

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`: Required if Google Login is enabled.

#### Email (Nodemailer)

- `MAIL_EMAIL`: Sender email address (e.g., a Gmail address).
- `MAIL_APP_PASS`: App password for the email account.
  _(Note: If unset during development, OTPs are safely logged to the console when `LOG_LEVEL=debug`)_

#### Stripe Payment

- `STRIPE_ENABLED`: Set to `true` to enable Stripe integration.
- `STRIPE_SECRET_KEY`: Your Stripe test secret key (`sk_test_...`).
- `STRIPE_WEBHOOK_SECRET`: Used to verify webhook signatures.
- `STRIPE_CURRENCY`: Default currency for Stripe charges (e.g., `usd`).

#### bKash Sandbox Payment

- `BKASH_ENABLED`: Set to `true` to enable bKash.
- `BKASH_BASE_URL`: bKash sandbox URL (`https://checkout.sandbox.bka.sh/v1.2.0-beta`).
- `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`: Sandbox credentials.
- `BKASH_CALLBACK_URL`: The callback URL (needs a public URL like ngrok).

#### File Upload (Cloudinary / DO Spaces)

- Configure `CLOUDINARY_*` or `DO_SPACE_*` variables depending on your storage preference.

---

## 2. Local ngrok Setup for Webhooks

Payment providers like Stripe and bKash need to send asynchronous notifications (webhooks or callbacks) to your server when a payment is processed. Since your local server (`localhost:5000` or `8080`) is not accessible from the public internet, you need a tunneling tool like **ngrok** to expose it.

### Step 2.1: Install and Run ngrok

1. **Install ngrok**: Download it from [ngrok.com](https://ngrok.com/download) or install via your package manager (e.g., `brew install ngrok`).
2. **Authenticate**: Add your auth token (found in your ngrok dashboard).
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
3. **Start the tunnel**: Point ngrok to your server's port (match the `PORT` in your `.env`).
   ```bash
   ngrok http 5000
   ```
4. **Copy the Forwarding URL**: ngrok will display a public URL (e.g., `https://ab12cd34.ngrok-free.app`). Leave this terminal window open.

### Step 2.2: Configure Stripe with ngrok

_Note: You can alternatively use the Stripe CLI for webhooks, but ngrok works identically._

1. Go to the **Stripe Dashboard** -> **Developers** -> **Webhooks**.
2. Click **Add endpoint**.
3. Enter your ngrok URL appended with the Stripe webhook route:
   `https://ab12cd34.ngrok-free.app/api/payments/stripe/webhook`
4. Select the events you want to listen to (e.g., `payment_intent.succeeded`, `payment_intent.payment_failed`).
5. Click **Add endpoint**.
6. Reveal the **Signing secret** (`whsec_...`) and update your `.env`:
   ```env
   STRIPE_ENABLED=true
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Step 2.3: Configure bKash Sandbox with ngrok

bKash uses a redirect flow that requires a callback URL to route the payer back to your system.

1. Ensure you have your bKash sandbox credentials (`BKASH_APP_KEY`, `BKASH_APP_SECRET`, etc.).
2. Update your `.env` file to use the ngrok URL for the `BKASH_CALLBACK_URL`:
   ```env
   BKASH_ENABLED=true
   BKASH_CALLBACK_URL=https://ab12cd34.ngrok-free.app/api/payments/bkash/callback
   ```
3. Restart your local Node.js server so it registers the new `.env` variables.

### Step 2.4: Testing the Flow

- **bKash**: Initiate an order and select bKash. You will receive a `bkashURL`. Open it to access the bKash sandbox UI. After payment, bKash redirects you to your `BKASH_CALLBACK_URL` (the ngrok URL). Ngrok routes this to your local server, completing the payment and order confirmation.
- **Stripe**: Pay using the Stripe frontend elements with a test card. Stripe's servers will send a webhook event to your ngrok URL. The webhook securely verifies the order and marks the payment as successful locally.

> **Important Note**: The ngrok free tier generates a new URL every time you restart the command. If you close and restart the ngrok process, you **must** update the `BKASH_CALLBACK_URL` and your Stripe Webhook endpoint with the newly generated URL, and restart your Node server.
