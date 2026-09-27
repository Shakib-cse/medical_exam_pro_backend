import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../generated/prisma";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma_v3?: PrismaClient;
};

function createMariaDbAdapter(): PrismaMariaDb {
  const connectionUrl = process.env.DATABASE_URL || "";
  try {
    const url = new URL(connectionUrl);
    return new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      connectionLimit: 10,
      idleTimeout: 60,
      minDelayValidation: 500,
      connectTimeout: 20000,
      acquireTimeout: 20000,
    });
  } catch {
    return new PrismaMariaDb(connectionUrl);
  }
}

const adapter = createMariaDbAdapter();

export const prisma =
  globalForPrisma.prisma_v3 ||
  new PrismaClient({
    adapter,
    log:
      process.env.DB_LOGGING === "true"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma_v3 = prisma;
}