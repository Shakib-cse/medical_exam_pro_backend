import { Router } from "express";
import { OverviewController } from "./OverviewController";
import { optionalAuthenticate } from "../../middleware/auth";

export function createOverviewRoutes(controller: OverviewController): Router {
  const router = Router();

  // Public/User routes
  router.get("/content", controller.getDashboardContent);
  router.get("/stats", optionalAuthenticate, controller.getUserStats);

  // Admin routes
  router.put("/content/:section", controller.upsertSection);
  router.delete("/content/:section", controller.deleteSection);

  return router;
}
