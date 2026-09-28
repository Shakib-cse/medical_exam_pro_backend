import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../generated/prisma";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma_v3?: PrismaClient;
};

function createMariaDbAdapter(): PrismaMariaDb {
  const connectionUrl = process.env.DATABASE_URL || "";
  const isServerless = process.env.VERCEL === "1" || !!process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
  const defaultLimit = isServerless ? 3 : 10;
  const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT) || defaultLimit;

  try {
    const url = new URL(connectionUrl);
    return new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      connectionLimit,
      idleTimeout: 30,
      minDelayValidation: 500,
      connectTimeout: 20000,
      acquireTimeout: 20000,
    });
  } catch {
    return new PrismaMariaDb(connectionUrl);
  }
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma_v3) {
    return globalForPrisma.prisma_v3;
  }

  const adapter = createMariaDbAdapter();
  const client = new PrismaClient({
    adapter,
    log:
      process.env.DB_LOGGING === "true"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

  globalForPrisma.prisma_v3 = client;
  return client;
}

export const prisma = getPrismaClient();