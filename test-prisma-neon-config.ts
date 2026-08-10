import dotenv from "dotenv";
dotenv.config();
import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma";
import ws from "ws";
neonConfig.webSocketConstructor = ws;

const cleanUrl = process.env.DATABASE_URL!.split("?")[0];
// PASS CONFIG INSTEAD OF POOL!
const adapter = new PrismaNeon({ connectionString: cleanUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.$queryRaw`SELECT 1 as test`;
  console.log("PrismaNeon with config result:", result);
}
main().catch(console.error).finally(() => prisma.$disconnect());
