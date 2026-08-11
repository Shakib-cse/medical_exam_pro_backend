// src/createApp.ts
import { IgnitorApp } from "./core/IgnitorApp";
import { AppLogger } from "./core/logging/logger";
import { PrismaProvider } from "./providers/PrismaProvider";
import { prisma } from "./lib/prisma";
import { AuthModule } from "./Modules/Auth/AuthModule";
import { MockExamModule } from "./Modules/MockExam/MockExamModule";
import { QuestionBankModule } from "./Modules/QuestionBank/QuestionBankModule";
import { OverviewModule } from "./Modules/Overview/OverviewModule";
import { Express } from "express";

let appInstance: Express | null = null;
let initPromise: Promise<Express> | null = null;

export async function createExpressApp(): Promise<Express> {
  if (appInstance) return appInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      AppLogger.info("🗹 Starting application bootstrap");

      const app = new IgnitorApp();

      // Infrastructure Providers
      app.getContext().registerProvider("prisma", new PrismaProvider(prisma));

      // Application Modules
      app.registerModule(new AuthModule());
      app.registerModule(new MockExamModule());
      app.registerModule(new QuestionBankModule());
      app.registerModule(new OverviewModule());

      const expressApp = await app.initialize();
      appInstance = expressApp;
      return expressApp;
    } catch (error) {
      AppLogger.error("⬤ Failed to initialize application:", {
        error: error instanceof Error ? error : new Error(String(error)),
        context: "application-bootstrap",
        stack: error instanceof Error ? error.stack : undefined,
      });
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}
