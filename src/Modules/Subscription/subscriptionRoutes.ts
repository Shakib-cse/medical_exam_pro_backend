import { Router } from "express";
import { SubscriptionController } from "./SubscriptionController";
import { authenticate } from "../../middleware/auth";

export function createSubscriptionRoutes(controller: SubscriptionController): Router {
  const router = Router();

  // Public plan listing
  router.get("/plans", controller.getPlans);

  // Authenticated routes
  router.get("/current", authenticate, controller.getCurrentSubscription);
  router.post("/checkout", authenticate, controller.createCheckout);
  router.post("/activate-dev", authenticate, controller.activateDev);

  // Webhook
  router.post("/webhook", controller.webhook);

  return router;
}
