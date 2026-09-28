import { PrismaClient, SubscriptionStatus } from "../../generated/prisma";
import { SUBSCRIPTION_PLANS, SubscriptionPlanDef, PlanCategory } from "./subscriptionTypes";
import { AppLogger } from "../../core/logging/logger";
import { CouponService } from "../Coupon/CouponService";
import Stripe from "stripe";
import dotenv from "dotenv";

export class SubscriptionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Helper to retrieve or initialize Stripe instance with dynamic .env reload
   */
  public getStripe(): Stripe {
    dotenv.config();
    const stripeKey = (process.env.STRIPE_SECRET_KEY || "").trim();
    const isPlaceholder =
      !stripeKey ||
      stripeKey.includes("placeholder") ||
      stripeKey.includes("your_secret_key") ||
      stripeKey.includes("here") ||
      stripeKey.length < 35;

    if (isPlaceholder || !stripeKey.startsWith("sk_")) {
      throw new Error(
        "Stripe Secret Key is not configured. Please paste your Stripe Test Secret Key (sk_test_...) from https://dashboard.stripe.com/test/apikeys into kawan-backend/.env as STRIPE_SECRET_KEY"
      );
    }

    return new Stripe(stripeKey, {
      apiVersion: "2025-02-24.acacia" as any,
    });
  }

  /**
   * Return all plans defined by client
   */
  public getPlans(): SubscriptionPlanDef[] {
    return Object.values(SUBSCRIPTION_PLANS);
  }

  /**
   * Return single plan definition
   */
  public getPlanById(planId: string): SubscriptionPlanDef | null {
    return SUBSCRIPTION_PLANS[planId] || null;
  }

  /**
   * Get user's current subscription details & permissions
   */
  public async getUserSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const now = new Date();
    const activeSub = user.subscriptions.find(
      (s) => s.status === SubscriptionStatus.ACTIVE && s.currentPeriodEnd && s.currentPeriodEnd > now
    );

    if (!activeSub) {
      return {
        isSubscribed: false,
        activePlan: SUBSCRIPTION_PLANS.free,
        subscription: null,
        daysRemaining: 0,
        unlockedFeatures: {
          hasFullMSRA: false,
          hasPD: false,
          hasMocks: false,
          isSampleOnly: true,
        },
      };
    }

    const planDef = SUBSCRIPTION_PLANS[activeSub.planId || ""] || {
      id: activeSub.planId || "custom",
      name: activeSub.planName || "Active Plan",
      category: activeSub.planType as PlanCategory,
      durationMonths: activeSub.durationMonths || 1,
      priceGBP: Number(activeSub.amount || 0),
      currency: activeSub.currency || "GBP",
      casesCount: activeSub.planType === "FULL_MSRA" ? 11007 : 2505,
      mockExamsCount: activeSub.planType === "FULL_MSRA" ? 10 : 0,
      description: activeSub.planName,
      features: [],
    };

    const diffMs = activeSub.currentPeriodEnd!.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const isFullMSRA = activeSub.planType === "FULL_MSRA";
    const isPD = activeSub.planType === "PD" || isFullMSRA;

    return {
      isSubscribed: true,
      activePlan: planDef,
      subscription: activeSub,
      daysRemaining,
      expiresAt: activeSub.currentPeriodEnd,
      unlockedFeatures: {
        hasFullMSRA: isFullMSRA,
        hasPD: isPD,
        hasMocks: isFullMSRA,
        isSampleOnly: false,
      },
    };
  }

  /**
   * Create Stripe Checkout session for one-off payment
   */
  public async createCheckoutSession(
    userId: string,
    planId: string,
    origin?: string,
    couponCode?: string
  ): Promise<{ checkoutUrl: string; sessionId: string; isFree?: boolean }> {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan || plan.id === "free") {
      throw new Error("Invalid subscription plan selected for purchase");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User account not found");
    }

    const baseUrl = origin || process.env.FRONTEND_URL || "http://localhost:3000";

    // Handle Coupon discount calculation if coupon provided
    let finalPrice = plan.priceGBP;
    let discountAmount = 0;
    let appliedCoupon: any = null;

    if (couponCode && couponCode.trim()) {
      const couponService = new CouponService(this.prisma);
      const validation = await couponService.validateCoupon(
        couponCode,
        planId,
        user.id,
        user.email
      );
      finalPrice = validation.finalPrice;
      discountAmount = validation.discountAmount;
      appliedCoupon = validation.coupon;
    }

    // If 100% discount, bypass Stripe payment entirely and activate immediately
    if (finalPrice <= 0) {
      const sub = await this.activateSubscription(userId, planId, {
        stripeSessionId: `free_coupon_${appliedCoupon?.code || "100"}_${Date.now()}`,
      });

      if (appliedCoupon) {
        const couponService = new CouponService(this.prisma);
        await couponService.recordRedemption({
          couponId: appliedCoupon.id,
          userId: user.id,
          planId: plan.id,
          originalPrice: plan.priceGBP,
          discountAmount: plan.priceGBP,
          finalPrice: 0,
          stripeSessionId: sub.stripeSessionId || "free_coupon",
        });
      }

      return {
        checkoutUrl: `${baseUrl}/dashboard/subscription?status=success&free_coupon=true&plan_id=${plan.id}`,
        sessionId: "free_coupon_activated",
        isFree: true,
      };
    }

    const stripe = this.getStripe();

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"], // card + Apple Pay/Google Pay enabled automatically
        mode: "payment", // STRICTLY ONE-OFF PAYMENT (NO AUTO-RENEWAL)
        customer_email: user.email,
        client_reference_id: user.id,
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: {
                name: appliedCoupon
                  ? `MedicalExamPro: ${plan.name} (${appliedCoupon.code} - ${appliedCoupon.discountValue}${appliedCoupon.discountType === "PERCENTAGE" ? "%" : " GBP"} OFF)`
                  : `MedicalExamPro: ${plan.name}`,
                description: plan.description,
                images: ["https://medicalexampro.co.uk/images/commonLayout/headerlogo.png"],
              },
              unit_amount: Math.round(finalPrice * 100), // in pence
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: user.id,
          planId: plan.id,
          planType: plan.category,
          planName: plan.name,
          durationMonths: String(plan.durationMonths),
          amount: String(finalPrice),
          originalAmount: String(plan.priceGBP),
          couponId: appliedCoupon?.id || "",
          couponCode: appliedCoupon?.code || "",
          discountAmount: String(discountAmount),
        },
        success_url: `${baseUrl}/dashboard/subscription?status=success&session_id={CHECKOUT_SESSION_ID}&plan_id=${plan.id}&coupon_code=${appliedCoupon?.code || ""}`,
        cancel_url: `${baseUrl}/dashboard/subscription?status=cancelled`,
      });

      if (!session.url) {
        throw new Error("Stripe did not return a checkout session URL.");
      }

      AppLogger.info(`💳 Real Stripe Checkout session created: ${session.id} for user ${user.id} (Price: £${finalPrice})`);

      return {
        checkoutUrl: session.url,
        sessionId: session.id,
      };
    } catch (stripeErr: any) {
      AppLogger.error("Stripe Checkout creation failed:", { error: stripeErr });
      throw new Error(stripeErr.message || "Failed to create Stripe Checkout session");
    }
  }

  /**
   * Activate or record one-off subscription in DB
   */
  public async activateSubscription(
    userId: string,
    planId: string,
    options: {
      stripeCustomerId?: string;
      stripeSessionId?: string;
      stripePaymentIntentId?: string;
      paymentMethod?: string;
      couponCode?: string;
    } = {}
  ) {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      throw new Error(`Invalid plan ${planId}`);
    }

    let resolvedCouponCode = options.couponCode;
    let resolvedCouponId: string | undefined;
    let discountAmount = 0;
    let finalAmount = plan.priceGBP;

    // If stripeSessionId is provided, check if we can retrieve session details from Stripe
    if (options.stripeSessionId && options.stripeSessionId.startsWith("cs_")) {
      try {
        const stripe = this.getStripe();
        const session = await stripe.checkout.sessions.retrieve(options.stripeSessionId);
        if (session.metadata) {
          if (!resolvedCouponCode && session.metadata.couponCode) {
            resolvedCouponCode = session.metadata.couponCode;
          }
          if (session.metadata.couponId) {
            resolvedCouponId = session.metadata.couponId;
          }
          if (session.metadata.discountAmount) {
            discountAmount = Number(session.metadata.discountAmount);
          }
          if (session.metadata.amount) {
            finalAmount = Number(session.metadata.amount);
          }
        }
      } catch (stripeErr) {
        AppLogger.warn("Could not retrieve Stripe session details:", stripeErr);
      }
    }

    // Check and record coupon redemption if a coupon code or ID was used
    if (resolvedCouponCode || resolvedCouponId) {
      try {
        const coupon = await this.prisma.coupon.findFirst({
          where: resolvedCouponId
            ? { id: resolvedCouponId }
            : { code: resolvedCouponCode?.trim().toUpperCase() },
        });

        if (coupon) {
          // Check if redemption is already recorded for this session or user
          const existingRedemption = await this.prisma.couponRedemption.findFirst({
            where: {
              couponId: coupon.id,
              userId,
              stripeSessionId: options.stripeSessionId || undefined,
            },
          });

          if (!existingRedemption) {
            if (discountAmount <= 0) {
              const val = Number(coupon.discountValue);
              discountAmount =
                coupon.discountType === "PERCENTAGE"
                  ? (plan.priceGBP * val) / 100
                  : val;
              finalAmount = Math.max(0, plan.priceGBP - discountAmount);
            }

            const couponService = new CouponService(this.prisma);
            await couponService.recordRedemption({
              couponId: coupon.id,
              userId,
              planId: plan.id,
              originalPrice: plan.priceGBP,
              discountAmount: Math.round(discountAmount * 100) / 100,
              finalPrice: Math.round(finalAmount * 100) / 100,
              stripeSessionId: options.stripeSessionId || undefined,
            });

            AppLogger.info(
              `🎟️ Coupon redemption recorded: Coupon ${coupon.code} for user ${userId} (Discount: £${discountAmount})`
            );
          }
        }
      } catch (couponErr) {
        AppLogger.error("Failed to record coupon redemption during subscription activation:", { error: couponErr });
      }
    }

    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + plan.durationMonths);

    // Cancel existing active subscriptions for this user
    await this.prisma.subscription.updateMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.CANCELED },
    });

    // Create new one-off active subscription
    const newSub = await this.prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        planName: plan.name,
        planType: plan.category,
        status: SubscriptionStatus.ACTIVE,
        amount: finalAmount,
        currency: "GBP",
        durationMonths: plan.durationMonths,
        isOneOff: true,
        currentPeriodEnd: expiryDate,
        stripeCustomerId: options.stripeCustomerId || null,
        stripeSessionId: options.stripeSessionId || null,
        stripePaymentIntentId: options.stripePaymentIntentId || null,
      },
    });

    AppLogger.info(`🎉 Subscription activated: User ${userId} -> Plan: ${plan.name} (Amount: £${finalAmount}, Expires: ${expiryDate.toISOString()})`);
    return newSub;
  }

  /**
   * Handle Stripe webhook event
   */
  public async handleStripeWebhook(eventPayload: string | Buffer, signature: string) {
    const stripe = this.getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("Stripe webhook secret is not configured in .env");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(eventPayload, signature, webhookSecret);
    } catch (err: any) {
      AppLogger.error("Stripe Webhook Signature Verification Failed:", { error: err });
      throw new Error(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId || session.client_reference_id;
      const planId = session.metadata?.planId;

      if (userId && planId) {
        await this.activateSubscription(userId, planId, {
          stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
          stripeSessionId: session.id,
          stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        });

        // Record coupon redemption if coupon metadata was attached
        const couponId = session.metadata?.couponId;
        if (couponId) {
          try {
            const couponService = new CouponService(this.prisma);
            await couponService.recordRedemption({
              couponId,
              userId,
              planId,
              originalPrice: Number(session.metadata?.originalAmount || 0),
              discountAmount: Number(session.metadata?.discountAmount || 0),
              finalPrice: Number(session.metadata?.amount || 0),
              stripeSessionId: session.id,
            });
          } catch (couponErr) {
            AppLogger.warn("Failed to record coupon redemption from webhook:", { error: couponErr });
          }
        }
      }
    }

    return { received: true };
  }
}
