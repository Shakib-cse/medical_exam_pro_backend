// api/index.ts (Vercel Serverless Function Entrypoint)
import { createExpressApp } from "../src/createApp";
import type { Request, Response } from "express";

export default async function handler(req: Request, res: Response) {
  const app = await createExpressApp();
  return app(req, res);
}
