import dotenv from "dotenv";
dotenv.config();
import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const cleanUrl = process.env.DATABASE_URL!.split("?")[0];
const pool = new Pool({ connectionString: cleanUrl });

async function main() {
  console.log("Testing direct pool query...");
  const rawResult = await pool.query("SELECT 1 as test");
  console.log("Raw pool result:", rawResult.rows);

  console.log("Testing Prisma adapter...");
  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({ adapter });
  const result = await prisma.$queryRaw`SELECT 1 as test`;
  console.log("Prisma result:", result);
}
main().catch(console.error);
