import { Router } from "express";
import { CouponController } from "./CouponController";
import { authenticate, optionalAuthenticate } from "../../middleware/auth";

export function createCouponRoutes(controller: CouponController): Router {
  const router = Router();

  // User route: validate coupon before purchase
  router.post("/validate", optionalAuthenticate, controller.validateCoupon);

  // Admin routes: management
  router.get("/", authenticate, controller.getAllCoupons);
  router.get("/generate-code", authenticate, controller.generateCode);
  router.get("/:id", authenticate, controller.getCouponById);
  router.post("/", authenticate, controller.createCoupon);
  router.put("/:id", authenticate, controller.updateCoupon);
  router.delete("/:id", authenticate, controller.deleteCoupon);

  return router;
}
