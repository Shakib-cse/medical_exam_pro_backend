import { Router } from "express";
import { OverviewController } from "./OverviewController";

export function createOverviewRoutes(controller: OverviewController): Router {
  const router = Router();

  // Public routes
  router.get("/content", controller.getDashboardContent);
  router.get("/stats", controller.getUserStats);

  // Admin routes
  router.put("/content/:section", controller.upsertSection);
  router.delete("/content/:section", controller.deleteSection);

  return router;
}
