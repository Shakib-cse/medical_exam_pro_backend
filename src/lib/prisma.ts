import dotenv from "dotenv";
dotenv.config();

import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma_v3?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma_v3 ||
  (() => {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.warn("⚠️ [DATABASE_URL] Missing in environment variables.");
      return new PrismaClient();
    }

    // Clear lingering env vars from old hot-reloaded state
    delete process.env.PGHOST;
    delete process.env.PGUSER;
    delete process.env.PGPASSWORD;
    delete process.env.PGDATABASE;
    delete process.env.PGPORT;
    delete process.env.PGSSLMODE;

    try {
      // Use standard Prisma Client for reliable Node/Bun database queries
      return new PrismaClient();
    } catch (_) {
      const cleanUrl = connectionString.split("?")[0].replace("postgresql://", "postgres://");
      const adapter = new PrismaNeon({ connectionString: cleanUrl });
      return new PrismaClient({ adapter });
    }
  })();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma_v3 = prisma;
}