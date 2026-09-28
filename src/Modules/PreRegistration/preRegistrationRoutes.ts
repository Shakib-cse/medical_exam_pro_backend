import { Router } from "express";
import { PreRegistrationController } from "./PreRegistrationController";
import { optionalAuthenticate } from "../../middleware/auth";

export function createPreRegistrationRoutes(controller: PreRegistrationController): Router {
  const router = Router();

  // Public candidate endpoints
  router.get("/stats", controller.getStats);
  router.post("/register", controller.register);
  router.post("/verify-otp", controller.verifyOtp);
  router.post("/resend-otp", controller.resendOtp);

  // Admin view & export endpoint
  router.get("/list", optionalAuthenticate, controller.getAllPreRegistrations);
  router.delete("/:id", optionalAuthenticate, controller.deletePreRegistration);

  return router;
}
