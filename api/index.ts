// api/index.ts (Vercel Serverless Function Entrypoint)
import { createExpressApp } from "../src/createApp";
import type { Request, Response } from "express";

let app: any = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!app) {
      app = await createExpressApp();
    }
    return new Promise<void>((resolve, reject) => {
      res.on("finish", () => resolve());
      res.on("close", () => resolve());
      res.on("error", (err) => reject(err));

      app(req, res, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  } catch (err: any) {
    console.error("❌ Vercel Serverless Function Error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Server Initialization Failed",
        details: err?.message || String(err),
      });
    }
  }
}


