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

  // Dedicated reports and flags routes
  router.get("/reports", controller.getReports);
  router.post("/reports", controller.addReport);
  router.patch("/reports/:id/status", controller.updateReportStatus);
  router.delete("/reports/:id", controller.deleteReport);

  router.get("/flags", controller.getFlags);
  router.post("/flags", controller.addFlag);
  router.delete("/flags/:id", controller.deleteFlag);

  // Dedicated support tickets routes
  router.get("/support", controller.getSupportTickets);
  router.post("/support", controller.createSupportTicket);
  router.patch("/support/:id/status", controller.updateSupportTicketStatus);
  router.delete("/support/:id", controller.deleteSupportTicket);

  return router;
}
