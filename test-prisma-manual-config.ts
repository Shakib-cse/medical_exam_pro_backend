import dotenv from "dotenv";
dotenv.config();
import { neonConfig, Pool } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma";
import ws from "ws";
neonConfig.webSocketConstructor = ws;

const url = new URL(process.env.DATABASE_URL!);
const poolConfig = {
  host: url.hostname,
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  port: parseInt(url.port || "5432"),
  ssl: true,
};
console.log("Pool Config:", { ...poolConfig, password: "***" });
const pool = new Pool(poolConfig);
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.$queryRaw`SELECT 1 as test`;
  console.log("Result:", result);
}
main().catch(console.error).finally(() => prisma.$disconnect());
