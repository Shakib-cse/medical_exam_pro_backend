export type DiscountType = "PERCENTAGE" | "FIXED";

export interface CreateCouponInput {
  code?: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minPurchaseAmount?: number;
  maxUses?: number;
  perUserLimit?: number;
  applicablePlans?: string[]; // null or empty for all plans
  isForSpecificUsers?: boolean;
  allowedUserEmails?: string[];
  allowedUserIds?: string[];
  expiresAt?: string | Date | null;
  isActive?: boolean;
}

export interface UpdateCouponInput {
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  maxUses?: number | null;
  perUserLimit?: number;
  applicablePlans?: string[] | null;
  isForSpecificUsers?: boolean;
  allowedUserEmails?: string[] | null;
  allowedUserIds?: string[] | null;
  expiresAt?: string | Date | null;
  isActive?: boolean;
}

export interface ValidateCouponResult {
  valid: boolean;
  coupon: {
    id: string;
    code: string;
    description?: string | null;
    discountType: DiscountType;
    discountValue: number;
    applicablePlans?: string[] | null;
  };
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  message?: string;
}
