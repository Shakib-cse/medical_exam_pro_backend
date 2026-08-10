import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const result = await prisma.$queryRaw`SELECT 1 as test`;
  console.log("Native Prisma result:", result);
}
main().catch(console.error);
