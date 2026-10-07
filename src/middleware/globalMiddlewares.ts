// src/middleware/globalMiddlewares.ts
import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { config } from "../core/config";
import { requestLogger } from "./requestLogger";
import { requestId } from "./requestId";
import { TimeoutError, RateLimitError } from "../core/errors/AppError";
import timeout from "connect-timeout";

import { AppLogger } from "../core/logging/logger";

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (!config.server.isProduction) return true;

  const rawAllowed = config.security.cors.allowedOrigins || "";
  const allowedList = rawAllowed
    .split(",")
    .map((url) => url.trim().toLowerCase())
    .filter(Boolean);

  if (allowedList.includes("*")) return true;

  const originLower = origin.toLowerCase().trim();
  if (allowedList.includes(originLower)) return true;

  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    const port = parsed.port;
    const protocol = parsed.protocol;

    // Localhost and loopback on any port
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;

    // Any Vercel preview or production deployment (*.vercel.app)
    if (hostname === "vercel.app" || hostname.endsWith(".vercel.app")) return true;

    // Production domain and any subdomains (*.medicalexampro.com, medicalexampro.com)
    if (hostname === "medicalexampro.com" || hostname.endsWith(".medicalexampro.com")) return true;

    // Match protocol + hostname + optional port in allowed list
    const normalized = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
    if (allowedList.includes(normalized)) return true;
  } catch {
    return false;
  }

  return false;
}

export function setupGlobalMiddlewares(app: Express) {
  app.set("trust proxy", 1);
  app.use(requestId());

  // CORS Middleware (placed early to handle preflight OPTIONS immediately)
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          AppLogger.warn(`[CORS] Blocked request from origin: ${origin}`);
          callback(new Error(`CORS error: Origin ${origin} not allowed`));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
        "X-Request-Id",
        "Cache-Control",
      ],
      exposedHeaders: ["X-Request-Id"],
      optionsSuccessStatus: 200,
    }),
  );

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(cookieParser());
  app.use(
    express.json({
      limit: "10mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(requestLogger());

  // Timeout middleware
  const timeoutMs = config.server.requestTimeout || 30000;
  app.use(timeout(`${timeoutMs}ms`));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const controller = new AbortController();
    req.abortSignal = controller.signal;

    // Trigger AbortSignal if connect-timeout fires
    req.on("timeout", () => {
      controller.abort("Request Timeout");
    });

    // Trigger AbortSignal if the user closes their browser tab early
    res.on("close", () => {
      if (!res.writableFinished && !req.timedout) {
        controller.abort("Client Disconnected");
      }
    });

    next();
  });

  // Rate Limiting
  if (config.server.isProduction) {
    app.use(
      rateLimit({
        windowMs: config.security.rateLimit.windowMs,
        max: config.security.rateLimit.max,
        handler: (_: Request, __: Response, next: NextFunction) => {
          next(new RateLimitError("Too many requests"));
        },
        skip: (req) => req.path === "/health",
      }),
    );
  }
}
