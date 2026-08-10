import dotenv from "dotenv";
dotenv.config();
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.$queryRaw`SELECT 1 as test`;
  console.log("Pg Adapter result:", result);
}
main().catch(console.error).finally(() => prisma.$disconnect());
