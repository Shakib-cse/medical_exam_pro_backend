import { Request, Response } from "express";
import { CouponService } from "./CouponService";
import { AppLogger } from "../../core/logging/logger";

export class CouponController {
  constructor(private readonly service: CouponService) {}

  private getUserId(req: Request): string | undefined {
    return req.user?.userId || (req.user as any)?.id;
  }

  private getUserEmail(req: Request): string | undefined {
    return req.user?.email || (req.user as any)?.email;
  }

  /**
   * GET /api/v1/coupons
   * List all coupons (Admin)
   */
  public getAllCoupons = async (_req: Request, res: Response): Promise<void> => {
    try {
      const coupons = await this.service.getAllCoupons();
      res.status(200).json({
        success: true,
        data: coupons,
      });
    } catch (error: any) {
      AppLogger.error("Failed to fetch coupons:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch coupons",
      });
    }
  };

  /**
   * GET /api/v1/coupons/generate-code
   * Helper to generate a random unique promo code (Admin)
   */
  public generateCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const prefix = (req.query.prefix as string) || "PROMO";
      const code = this.service.generateRandomCode(prefix);
      res.status(200).json({
        success: true,
        data: { code },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate code",
      });
    }
  };

  /**
   * GET /api/v1/coupons/:id
   * Get single coupon details and redemptions (Admin)
   */
  public getCouponById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const coupon = await this.service.getCouponById(id);
      res.status(200).json({
        success: true,
        data: coupon,
      });
    } catch (error: any) {
      AppLogger.error("Failed to fetch coupon by ID:", { error });
      res.status(404).json({
        success: false,
        message: error.message || "Coupon not found",
      });
    }
  };

  /**
   * POST /api/v1/coupons
   * Create a new coupon (Admin)
   */
  public createCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
      const coupon = await this.service.createCoupon(req.body);
      res.status(201).json({
        success: true,
        data: coupon,
        message: "Coupon created successfully!",
      });
    } catch (error: any) {
      AppLogger.error("Failed to create coupon:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to create coupon",
      });
    }
  };

  /**
   * PUT /api/v1/coupons/:id
   * Update coupon (Admin)
   */
  public updateCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updated = await this.service.updateCoupon(id, req.body);
      res.status(200).json({
        success: true,
        data: updated,
        message: "Coupon updated successfully!",
      });
    } catch (error: any) {
      AppLogger.error("Failed to update coupon:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update coupon",
      });
    }
  };

  /**
   * DELETE /api/v1/coupons/:id
   * Delete coupon (Admin)
   */
  public deleteCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.deleteCoupon(id);
      res.status(200).json({
        success: true,
        message: "Coupon deleted successfully",
      });
    } catch (error: any) {
      AppLogger.error("Failed to delete coupon:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete coupon",
      });
    }
  };

  /**
   * POST /api/v1/coupons/validate
   * Validate coupon code for user and calculate final price
   */
  public validateCoupon = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, planId } = req.body;
      if (!code) {
        res.status(400).json({ success: false, message: "Coupon code is required" });
        return;
      }

      const userId = this.getUserId(req);
      const userEmail = this.getUserEmail(req);

      const result = await this.service.validateCoupon(code, planId, userId, userEmail);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Invalid coupon code",
      });
    }
  };
}
