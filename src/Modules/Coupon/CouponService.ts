import { PrismaClient } from "../../generated/prisma";
import { CreateCouponInput, UpdateCouponInput, ValidateCouponResult } from "./CouponTypes";
import { SUBSCRIPTION_PLANS } from "../Subscription/subscriptionTypes";
import { AppLogger } from "../../core/logging/logger";
import crypto from "crypto";

export class CouponService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate an uppercase random promotional code
   */
  public generateRandomCode(prefix = "PROMO"): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omits confusing 0/O and 1/I
    let randomPart = "";
    for (let i = 0; i < 6; i++) {
      randomPart += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return `${prefix}-${randomPart}`;
  }

  /**
   * Create a new coupon (for everyone or specific users)
   */
  public async createCoupon(input: CreateCouponInput) {
    const rawCode = input.code?.trim() || this.generateRandomCode();
    const normalizedCode = rawCode.toUpperCase().replace(/\s+/g, "");

    const existing = await this.prisma.coupon.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      throw new Error(`Coupon with code "${normalizedCode}" already exists.`);
    }

    if (input.discountValue <= 0) {
      throw new Error("Discount value must be greater than 0.");
    }

    if (input.discountType === "PERCENTAGE" && input.discountValue > 100) {
      throw new Error("Percentage discount cannot exceed 100%.");
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code: normalizedCode,
        description: input.description?.trim() || null,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minPurchaseAmount: input.minPurchaseAmount ?? null,
        maxUses: input.maxUses ?? null,
        perUserLimit: input.perUserLimit ?? 1,
        applicablePlans: input.applicablePlans && input.applicablePlans.length > 0 ? input.applicablePlans : null,
        isForSpecificUsers: Boolean(input.isForSpecificUsers),
        allowedUserEmails: input.allowedUserEmails && input.allowedUserEmails.length > 0 ? input.allowedUserEmails : null,
        allowedUserIds: input.allowedUserIds && input.allowedUserIds.length > 0 ? input.allowedUserIds : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        isActive: input.isActive ?? true,
      },
    });

    AppLogger.info(`🎟️ Coupon created: ${coupon.code} (${coupon.discountValue} ${coupon.discountType})`);
    return coupon;
  }

  /**
   * Get all coupons with redemption metrics
   */
  public async getAllCoupons() {
    const coupons = await this.prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { redemptions: true },
        },
      },
    });

    return coupons.map((c) => ({
      ...c,
      discountValue: Number(c.discountValue),
      minPurchaseAmount: c.minPurchaseAmount ? Number(c.minPurchaseAmount) : null,
      redemptionsCount: c._count.redemptions,
    }));
  }

  /**
   * Get single coupon with recent redemptions
   */
  public async getCouponById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        redemptions: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!coupon) {
      throw new Error("Coupon not found");
    }

    return {
      ...coupon,
      discountValue: Number(coupon.discountValue),
      minPurchaseAmount: coupon.minPurchaseAmount ? Number(coupon.minPurchaseAmount) : null,
      redemptions: coupon.redemptions.map((r) => ({
        ...r,
        originalPrice: Number(r.originalPrice),
        discountAmount: Number(r.discountAmount),
        finalPrice: Number(r.finalPrice),
      })),
    };
  }

  /**
   * Update coupon
   */
  public async updateCoupon(id: string, input: UpdateCouponInput) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    const data: any = {};
    if (input.description !== undefined) data.description = input.description;
    if (input.discountType !== undefined) data.discountType = input.discountType;
    if (input.discountValue !== undefined) data.discountValue = input.discountValue;
    if (input.maxUses !== undefined) data.maxUses = input.maxUses;
    if (input.perUserLimit !== undefined) data.perUserLimit = input.perUserLimit;
    if (input.applicablePlans !== undefined) data.applicablePlans = input.applicablePlans;
    if (input.isForSpecificUsers !== undefined) data.isForSpecificUsers = input.isForSpecificUsers;
    if (input.allowedUserEmails !== undefined) data.allowedUserEmails = input.allowedUserEmails;
    if (input.allowedUserIds !== undefined) data.allowedUserIds = input.allowedUserIds;
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const updated = await this.prisma.coupon.update({
      where: { id },
      data,
    });

    return {
      ...updated,
      discountValue: Number(updated.discountValue),
    };
  }

  /**
   * Delete coupon
   */
  public async deleteCoupon(id: string) {
    await this.prisma.coupon.delete({
      where: { id },
    });
    return { success: true };
  }

  /**
   * Validate a coupon code for a specific user and plan
   */
  public async validateCoupon(
    code: string,
    planId?: string,
    userId?: string,
    userEmail?: string
  ): Promise<ValidateCouponResult> {
    const normalizedCode = (code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!normalizedCode) {
      throw new Error("Please enter a coupon code.");
    }

    const coupon = await this.prisma.coupon.findUnique({
      where: { code: normalizedCode },
    });

    if (!coupon) {
      throw new Error(`Invalid coupon code "${normalizedCode}".`);
    }

    if (!coupon.isActive) {
      throw new Error("This coupon is no longer active.");
    }

    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new Error("This coupon has expired.");
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new Error("This coupon code has reached its maximum usage limit.");
    }

    // Check specific user targeting
    if (coupon.isForSpecificUsers) {
      const allowedEmails = Array.isArray(coupon.allowedUserEmails)
        ? (coupon.allowedUserEmails as string[]).map((e) => e.toLowerCase().trim())
        : [];
      const allowedIds = Array.isArray(coupon.allowedUserIds)
        ? (coupon.allowedUserIds as string[])
        : [];

      const matchesEmail = userEmail && allowedEmails.includes(userEmail.toLowerCase().trim());
      const matchesId = userId && allowedIds.includes(userId);

      if (!matchesEmail && !matchesId) {
        throw new Error("This coupon code is not valid for your account.");
      }
    }

    // Check per-user redemption limit if user is authenticated
    if (userId) {
      const userRedemptionsCount = await this.prisma.couponRedemption.count({
        where: {
          couponId: coupon.id,
          userId,
        },
      });

      if (userRedemptionsCount >= coupon.perUserLimit) {
        throw new Error(
          `You have already redeemed this coupon the maximum allowed number of times (${coupon.perUserLimit}x).`
        );
      }
    }

    // Check applicable plan if specified
    let originalPrice = 0;
    let discountAmount = 0;
    let finalPrice = 0;

    const discountVal = Number(coupon.discountValue);

    if (planId) {
      const plan = SUBSCRIPTION_PLANS[planId];
      if (!plan || plan.id === "free") {
        throw new Error("Invalid plan selected for coupon redemption.");
      }

      if (coupon.applicablePlans && Array.isArray(coupon.applicablePlans) && (coupon.applicablePlans as string[]).length > 0) {
        const allowedPlans = coupon.applicablePlans as string[];
        if (!allowedPlans.includes(planId)) {
          throw new Error(`This coupon is not valid for the "${plan.name}" plan.`);
        }
      }

      originalPrice = plan.priceGBP;

      if (coupon.discountType === "PERCENTAGE") {
        discountAmount = (originalPrice * discountVal) / 100;
      } else {
        discountAmount = discountVal;
      }

      // Clamp discount amount
      discountAmount = Math.min(originalPrice, Math.max(0, discountAmount));
      finalPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);
    }

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType as any,
        discountValue: discountVal,
        applicablePlans: coupon.applicablePlans as string[] | null,
      },
      originalPrice,
      discountAmount: Math.round(discountAmount * 100) / 100,
      finalPrice,
      message: `Coupon applied: ${discountVal}${coupon.discountType === "PERCENTAGE" ? "%" : " GBP"} discount`,
    };
  }

  /**
   * Record a completed coupon redemption in DB
   */
  public async recordRedemption(params: {
    couponId: string;
    userId: string;
    planId: string;
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
    stripeSessionId?: string;
  }) {
    const redemption = await this.prisma.couponRedemption.create({
      data: {
        couponId: params.couponId,
        userId: params.userId,
        planId: params.planId,
        originalPrice: params.originalPrice,
        discountAmount: params.discountAmount,
        finalPrice: params.finalPrice,
        stripeSessionId: params.stripeSessionId || null,
      },
    });

    // Increment coupon used count
    await this.prisma.coupon.update({
      where: { id: params.couponId },
      data: {
        usedCount: { increment: 1 },
      },
    });

    AppLogger.info(`🎉 Coupon redeemed: Coupon ${params.couponId} by User ${params.userId} for Plan ${params.planId}`);
    return redemption;
  }
}
