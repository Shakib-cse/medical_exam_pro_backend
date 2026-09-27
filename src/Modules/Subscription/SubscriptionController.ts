import { Request, Response } from "express";
import { SubscriptionService } from "./SubscriptionService";
import { AppLogger } from "../../core/logging/logger";

export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) { }

  private getUserId(req: Request): string | undefined {
    return req.user?.userId || (req.user as any)?.id;
  }

  /**
   * GET /api/v1/subscription/plans
   */
  public getPlans = async (req: Request, res: Response): Promise<void> => {
    try {
      const plans = this.service.getPlans();
      res.status(200).json({
        success: true,
        data: plans,
      });
    } catch (error: any) {
      AppLogger.error("Failed to get subscription plans:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get plans",
      });
    }
  };

  /**
   * GET /api/v1/subscription/current
   */
  public getCurrentSubscription = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const subscription = await this.service.getUserSubscription(userId);
      res.status(200).json({
        success: true,
        data: subscription,
      });
    } catch (error: any) {
      AppLogger.error("Failed to get current subscription:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get current subscription",
      });
    }
  };

  /**
   * POST /api/v1/subscription/checkout
   */
  public createCheckout = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { planId, couponCode } = req.body;
      if (!planId) {
        res.status(400).json({ success: false, message: "planId is required" });
        return;
      }

      const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
      const result = await this.service.createCheckoutSession(userId, planId, origin, couponCode);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      AppLogger.error("Failed to create checkout session:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to create checkout session",
      });
    }
  };

  /**
   * POST /api/v1/subscription/activate-dev
   * Allows activating a plan directly in dev mode or after success redirect
   */
  public activateDev = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const { planId, sessionId, couponCode } = req.body;
      if (!planId) {
        res.status(400).json({ success: false, message: "planId is required" });
        return;
      }

      const subscription = await this.service.activateSubscription(userId, planId, {
        stripeSessionId: sessionId || `manual_${Date.now()}`,
        couponCode,
      });

      res.status(200).json({
        success: true,
        data: subscription,
        message: "Subscription activated successfully!",
      });
    } catch (error: any) {
      AppLogger.error("Failed to activate dev subscription:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to activate subscription",
      });
    }
  };

  /**
   * POST /api/v1/subscription/webhook
   */
  public webhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const signature = req.headers["stripe-signature"] as string;
      const rawBody = (req as any).rawBody || req.body;

      await this.service.handleStripeWebhook(rawBody, signature);
      res.status(200).json({ received: true });
    } catch (error: any) {
      AppLogger.error("Stripe webhook failed:", { error });
      res.status(400).json({ error: error.message || "Webhook error" });
    }
  };
}
