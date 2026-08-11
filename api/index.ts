// api/index.ts (Vercel Serverless Function Entrypoint)
import { createExpressApp } from "../src/createApp";
import type { Request, Response } from "express";

let appPromise: Promise<any> | null = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!appPromise) {
      appPromise = createExpressApp();
    }
    const app = await appPromise;
    return app(req, res);
  } catch (err: any) {
    console.error("❌ Vercel Serverless Function Error:", err);
    res.status(500).json({
      success: false,
      error: "Server Initialization Failed",
      details: err?.message || String(err),
      hint: "Check that environment variables (DATABASE_URL, JWT_SECRET, etc.) are properly configured in your Vercel Project Settings.",
    });
  }
}

