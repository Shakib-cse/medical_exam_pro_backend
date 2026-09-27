export type PlanCategory = "FREE" | "PD" | "FULL_MSRA";

export interface SubscriptionPlanDef {
  id: string; // e.g. "free", "pd_1m", "pd_3m", "pd_6m", "msra_1m", "msra_3m", "msra_6m"
  name: string;
  category: PlanCategory;
  durationMonths: number;
  priceGBP: number;
  currency: string;
  casesCount: number;
  mockExamsCount: number;
  description: string;
  features: string[];
  isPopular?: boolean;
  isBestValue?: boolean;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlanDef> = {
  free: {
    id: "free",
    name: "Free Sample Plan",
    category: "FREE",
    durationMonths: 0,
    priceGBP: 0,
    currency: "GBP",
    casesCount: 40,
    mockExamsCount: 0,
    description: "Limited sample access with no payment required.",
    features: [
      "40 Sample Cases (3 CPS Specialties + 1 PD Domain)",
      "Standard answer explanations & rationale",
      "No payment or credit card required",
    ],
  },
  pd_1m: {
    id: "pd_1m",
    name: "Professional Dilemmas - 1 Month",
    category: "PD",
    durationMonths: 1,
    priceGBP: 24,
    currency: "GBP",
    casesCount: 2505,
    mockExamsCount: 0,
    description: "Full access to 2,505 Professional Dilemmas cases for 1 month.",
    features: [
      "2,505 Professional Dilemmas (SJT) cases",
      "Ranking & Multiple Choice (Select 3) formats",
      "GMC Good Medical Practice guidance rationale",
      "Concordance matrix scoring & peer benchmarking",
      "One-off payment (No automatic renewal)",
    ],
  },
  pd_3m: {
    id: "pd_3m",
    name: "Professional Dilemmas - 3 Months",
    category: "PD",
    durationMonths: 3,
    priceGBP: 39,
    currency: "GBP",
    casesCount: 2505,
    mockExamsCount: 0,
    description: "Full access to 2,505 Professional Dilemmas cases for 3 months.",
    features: [
      "2,505 Professional Dilemmas (SJT) cases",
      "Ranking & Multiple Choice (Select 3) formats",
      "GMC Good Medical Practice guidance rationale",
      "Concordance matrix scoring & peer benchmarking",
      "One-off payment (No automatic renewal)",
      "Save 45% vs monthly plan",
    ],
    isPopular: true,
  },
  pd_6m: {
    id: "pd_6m",
    name: "Professional Dilemmas - 6 Months",
    category: "PD",
    durationMonths: 6,
    priceGBP: 49,
    currency: "GBP",
    casesCount: 2505,
    mockExamsCount: 0,
    description: "Full access to 2,505 Professional Dilemmas cases for 6 months.",
    features: [
      "2,505 Professional Dilemmas (SJT) cases",
      "Ranking & Multiple Choice (Select 3) formats",
      "GMC Good Medical Practice guidance rationale",
      "Concordance matrix scoring & peer benchmarking",
      "One-off payment (No automatic renewal)",
      "Best Value for SJT preparation",
    ],
    isBestValue: true,
  },
  msra_1m: {
    id: "msra_1m",
    name: "Full MSRA - 1 Month",
    category: "FULL_MSRA",
    durationMonths: 1,
    priceGBP: 39,
    currency: "GBP",
    casesCount: 11007,
    mockExamsCount: 10,
    description: "11,007 cases + 10 full mock exams for 1 month.",
    features: [
      "All 11,007 Questions (8,502 CPS + 2,505 PD)",
      "All 13 Clinical Problem Solving Specialties (SBA & EMQ)",
      "All 3 Professional Dilemmas Domains",
      "10 Realistic Full-Length Mock Exams with 5-minute break",
      "Detailed clinical vignettes & GMC explanations",
      "One-off payment (No automatic renewal)",
    ],
  },
  msra_3m: {
    id: "msra_3m",
    name: "Full MSRA - 3 Months",
    category: "FULL_MSRA",
    durationMonths: 3,
    priceGBP: 69,
    currency: "GBP",
    casesCount: 11007,
    mockExamsCount: 10,
    description: "11,007 cases + 10 full mock exams for 3 months.",
    features: [
      "All 11,007 Questions (8,502 CPS + 2,505 PD)",
      "All 13 Clinical Problem Solving Specialties (SBA & EMQ)",
      "All 3 Professional Dilemmas Domains",
      "10 Realistic Full-Length Mock Exams with 5-minute break",
      "Detailed clinical vignettes & GMC explanations",
      "One-off payment (No automatic renewal)",
      "Most Popular MSRA Study Timeline",
    ],
    isPopular: true,
  },
  msra_6m: {
    id: "msra_6m",
    name: "Full MSRA - 6 Months",
    category: "FULL_MSRA",
    durationMonths: 6,
    priceGBP: 89,
    currency: "GBP",
    casesCount: 11007,
    mockExamsCount: 10,
    description: "11,007 cases + 10 full mock exams for 6 months.",
    features: [
      "All 11,007 Questions (8,502 CPS + 2,505 PD)",
      "All 13 Clinical Problem Solving Specialties (SBA & EMQ)",
      "All 3 Professional Dilemmas Domains",
      "10 Realistic Full-Length Mock Exams with 5-minute break",
      "Detailed clinical vignettes & GMC explanations",
      "One-off payment (No automatic renewal)",
      "Ultimate Comprehensive MSRA Pass",
    ],
    isBestValue: true,
  },
};
