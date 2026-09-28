import { Request, Response } from "express";
import { PreRegistrationService } from "./PreRegistrationService";
import {
  RegisterPreRegSchema,
  VerifyPreRegOtpSchema,
  ResendPreRegOtpSchema,
} from "./PreRegistrationTypes";
import { AppLogger } from "../../core/logging/logger";

export class PreRegistrationController {
  constructor(private readonly service: PreRegistrationService) {}

  /**
   * GET /api/v1/preregistration/stats
   * Get total verified users and remaining discount spots
   */
  public getStats = async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.service.getStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      AppLogger.error("Failed to get pre-registration stats:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get stats",
      });
    }
  };

  /**
   * POST /api/v1/preregistration/register
   * Submit name, email, and password to pre-register and trigger OTP email
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      const parseResult = RegisterPreRegSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          message: parseResult.error.issues[0]?.message || "Invalid input data",
          errors: parseResult.error.flatten(),
        });
        return;
      }

      const result = await this.service.register(parseResult.data);
      res.status(200).json(result);
    } catch (error: any) {
      AppLogger.error("Failed to pre-register candidate:", { error });
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to process pre-registration",
      });
    }
  };

  /**
   * POST /api/v1/preregistration/verify-otp
   * Submit 6-digit OTP to complete registration and reserve discount spot
   */
  public verifyOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const parseResult = VerifyPreRegOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          message: parseResult.error.issues[0]?.message || "Invalid OTP data",
        });
        return;
      }

      const result = await this.service.verifyOtp(parseResult.data);
      res.status(200).json(result);
    } catch (error: any) {
      AppLogger.error("Failed to verify pre-registration OTP:", { error });
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Verification failed",
      });
    }
  };

  /**
   * POST /api/v1/preregistration/resend-otp
   * Request a fresh 6-digit verification code
   */
  public resendOtp = async (req: Request, res: Response): Promise<void> => {
    try {
      const parseResult = ResendPreRegOtpSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          message: parseResult.error.issues[0]?.message || "Email is required",
        });
        return;
      }

      const result = await this.service.resendOtp(parseResult.data);
      res.status(200).json(result);
    } catch (error: any) {
      AppLogger.error("Failed to resend pre-registration OTP:", { error });
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to resend code",
      });
    }
  };

  /**
   * GET /api/v1/preregistration/list
   * List all pre-registrations for Admin
   */
  public getAllPreRegistrations = async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.service.getAllPreRegistrations();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch pre-registrations",
      });
    }
  };

  /**
   * DELETE /api/v1/preregistration/:id
   * Delete pre-registration and shift next users up
   */
  public deletePreRegistration = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.service.deletePreRegistration(id);
      res.status(200).json(result);
    } catch (error: any) {
      AppLogger.error("Failed to delete pre-registration:", { error });
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to delete candidate",
      });
    }
  };
}

