import { Router } from "express";
import { AuthController } from "./AuthController";
import { validateRequest } from "@/middleware/validation";
import { authenticate } from "@/middleware/auth";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "./authSchemas";

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  router.post("/register", validateRequest(registerSchema), authController.register);
  router.post("/verify-otp", validateRequest(verifyOtpSchema), authController.verifyOtp);
  router.post("/resend-otp", validateRequest(resendOtpSchema), authController.resendOtp);
  router.post("/login", validateRequest(loginSchema), authController.login);
  router.post("/forgot-password", validateRequest(forgotPasswordSchema), authController.forgotPassword);
  router.post("/reset-password", validateRequest(resetPasswordSchema), authController.resetPassword);
  router.get("/me", authenticate, authController.getCurrentUser);
  router.put("/profile", authenticate, validateRequest(updateProfileSchema), authController.updateProfile);
  router.put("/change-password", authenticate, validateRequest(changePasswordSchema), authController.changePassword);

  // Admin User Management
  router.get("/users", authenticate, authController.getAllUsers);
  router.post("/users", authenticate, authController.createUser);
  router.put("/users/:id/status", authenticate, authController.updateUserStatus);
  router.delete("/users/:id", authenticate, authController.deleteUser);

  return router;
}
