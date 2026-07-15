import { Redis } from "ioredis";
import config from "../../config/index.js";

let client: Redis | null = null;
let warned = false;
let lastFailureAt = 0;

const RETRY_COOLDOWN_MS = 30_000;

const warnOnce = (err: unknown) => {
  if (!warned) {
    warned = true;
    console.warn("Redis unavailable (caching disabled)", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
};

const getClient = (): Redis => {
  if (client && client.status === "end") {
    if (Date.now() - lastFailureAt < RETRY_COOLDOWN_MS) {
      throw new Error("Redis connection is down");
    }
    client.removeAllListeners();
    client = null;
  }

  if (!client) {
    client = new Redis(config.redis.url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) =>
        times > 3 ? null : Math.min(times * 200, 1000),
    });
    client.on("error", (err) => {
      lastFailureAt = Date.now();
      warnOnce(err);
    });
  }

  return client;
};

export const redisGet = async (key: string): Promise<string | null> => {
  try {
    return await getClient().get(key);
  } catch (err) {
    warnOnce(err);
    return null;
  }
};

export const redisSet = async (
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> => {
  try {
    await getClient().set(key, value, "EX", ttlSeconds);
    return true;
  } catch (err) {
    warnOnce(err);
    return false;
  }
};

export const redisDel = async (key: string): Promise<boolean> => {
  try {
    await getClient().del(key);
    return true;
  } catch (err) {
    warnOnce(err);
    return false;
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (client) {
    client.disconnect();
    client = null;
  }
};
