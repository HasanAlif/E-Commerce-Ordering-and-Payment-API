import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set");
}

const parseBool = (value: string | undefined, defaultValue = false): boolean =>
  value === undefined
    ? defaultValue
    : ["true", "1", "yes"].includes(value.toLowerCase());

const stripeEnabled = parseBool(process.env.STRIPE_ENABLED);
const bkashEnabled = parseBool(process.env.BKASH_ENABLED);

if (stripeEnabled && !process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "FATAL: STRIPE_ENABLED is true but STRIPE_SECRET_KEY is not set",
  );
}
if (stripeEnabled && !process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error(
    "FATAL: STRIPE_ENABLED is true but STRIPE_WEBHOOK_SECRET is not set",
  );
}

if (bkashEnabled) {
  const missing = [
    "BKASH_BASE_URL",
    "BKASH_APP_KEY",
    "BKASH_APP_SECRET",
    "BKASH_USERNAME",
    "BKASH_PASSWORD",
    "BKASH_CALLBACK_URL",
  ].filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `FATAL: BKASH_ENABLED is true but missing: ${missing.join(", ")}`,
    );
  }
}

export default {
  env: process.env.NODE_ENV,
  port: Number(process.env.PORT) || 5000,
  bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  jwt: {
    jwt_secret: process.env.JWT_SECRET,
    expires_in: process.env.EXPIRES_IN || "7d",
    refresh_token_secret: process.env.REFRESH_TOKEN_SECRET,
    refresh_token_expires_in: process.env.REFRESH_TOKEN_EXPIRES_IN,
    reset_pass_secret: process.env.RESET_PASS_TOKEN,
    reset_pass_token_expires_in: process.env.RESET_PASS_TOKEN_EXPIRES_IN,
  },
  reset_pass_link: process.env.RESET_PASS_LINK,
  emailSender: {
    email: process.env.MAIL_EMAIL,
    app_pass: process.env.MAIL_APP_PASS,
  },
  site_name: process.env.WEBSITE_NAME,
  contact_mail: process.env.CONTACT_MAIL,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  cors_origins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
    : ["http://localhost:3000", "http://localhost:3001"],
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  default_currency: process.env.DEFAULT_CURRENCY || "usd",
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    category_tree_ttl: Number(process.env.CATEGORY_TREE_TTL) || 3600,
  },
  stripe: {
    enabled: stripeEnabled,
    secret_key: process.env.STRIPE_SECRET_KEY,
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
    currency: process.env.STRIPE_CURRENCY || "usd",
  },
  bkash: {
    enabled: bkashEnabled,
    base_url: process.env.BKASH_BASE_URL,
    app_key: process.env.BKASH_APP_KEY,
    app_secret: process.env.BKASH_APP_SECRET,
    username: process.env.BKASH_USERNAME,
    password: process.env.BKASH_PASSWORD,
    callback_url: process.env.BKASH_CALLBACK_URL,
  },
  seed_admin: {
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
  },
};
