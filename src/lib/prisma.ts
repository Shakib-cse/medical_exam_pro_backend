import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "../generated/prisma";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const globalForPrisma = globalThis as unknown as {
  prisma_v3?: PrismaClient;
};

const connectionUrl = process.env.DATABASE_URL || "";
const adapter = new PrismaMariaDb(connectionUrl);

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