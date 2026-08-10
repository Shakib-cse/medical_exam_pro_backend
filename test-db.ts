import dotenv from "dotenv";
dotenv.config();

import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;
console.log("DB URL is:", connectionString);

const cleanUrl = connectionString.split("?")[0];
console.log("Clean URL is:", cleanUrl);

const pool = new Pool({ connectionString: cleanUrl });

async function test() {
  try {
    console.log("Connecting...");
    const res = await pool.query("SELECT 1 AS ok");
    console.log("Connection successful, result:", res.rows);
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await pool.end();
  }
}

test();
