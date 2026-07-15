import "dotenv/config";
import net from "net";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

net.setDefaultAutoSelectFamilyAttemptTimeout(2000);

const normalizeSslMode = (rawUrl: string): string => {
  const url = new URL(rawUrl);
  const sslMode = (url.searchParams.get("sslmode") || "").toLowerCase();
  const libpqCompat =
    (url.searchParams.get("uselibpqcompat") || "").toLowerCase() === "true";

  if (!libpqCompat && ["require", "prefer", "verify-ca"].includes(sslMode)) {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
};

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("FATAL: DATABASE_URL environment variable is not set");
}

const connectionString = normalizeSslMode(databaseUrl);

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma };
