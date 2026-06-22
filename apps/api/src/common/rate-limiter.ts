import { Request, Response, NextFunction } from "express";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 300;

const ipBuckets = new Map<string, { count: number; resetAt: number }>();

export function basicRateLimiter(request: Request, response: Response, next: NextFunction) {
  const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const current = ipBuckets.get(ip);

  if (!current || current.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return response.status(429).json({
      message: "Too many requests, slow down."
    });
  }

  current.count += 1;
  ipBuckets.set(ip, current);
  return next();
}
