import dotenv from "dotenv";
dotenv.config();
import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const connectionString = process.env.DATABASE_URL!;
const cleanUrl = connectionString.split("?")[0];
console.log("Clean URL:", cleanUrl);
const pool = new Pool({ connectionString: cleanUrl });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });
async function main() {
  const result = await prisma.$queryRaw`SELECT 1 as test`;
  console.log("Prisma adapter result:", result);
}
main().catch(console.error).finally(() => prisma.$disconnect());
