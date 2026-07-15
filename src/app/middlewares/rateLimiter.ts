import { rateLimit } from "express-rate-limit";
import { Request, Response } from "express";

const rateLimitHandler = (req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    message: "Too many requests, please try again later",
    errorSources: [{ path: req.originalUrl, message: "Rate limit exceeded" }],
  });
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path.startsWith("/stripe/webhook") ||
    req.path.startsWith("/bkash/callback"),
  handler: rateLimitHandler,
});
