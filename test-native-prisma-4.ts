import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@/generated/prisma";
const prisma = new PrismaClient({ log: ['info'] });
async function main() {
  const result = await prisma.$queryRaw`SELECT 1 as test`;
  console.log("Native Prisma result:", result);
}
main().catch(console.error);
