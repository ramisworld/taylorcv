export type PlanKey =
  | "free"
  | "pro_annual"
  | "pro_monthly"
  | "premium_annual"
  | "premium_monthly";

export type PlanFamily = "free" | "pro" | "premium";
export type PlanVariant = "free" | "annual" | "monthly";

export type PlanConfig = {
  key: PlanKey;
  displayName: string;
  uiLabel: string;
  stripePriceEnvKey: string | null;
  monthlyDisplayPriceNzd: number;
  cvGenerationQuota: number;
  quotaInterval: "one_time" | "monthly";
  family: PlanFamily;
  variant: PlanVariant;
  savingsPercentage: number | null;
  paid: boolean;
  requiresTwelveMonthCommitment: boolean;
};

export const plans = {
  free: {
    key: "free",
    displayName: "Free",
    uiLabel: "Free",
    stripePriceEnvKey: null,
    monthlyDisplayPriceNzd: 0,
    cvGenerationQuota: 1,
    quotaInterval: "one_time",
    family: "free",
    variant: "free",
    savingsPercentage: null,
    paid: false,
    requiresTwelveMonthCommitment: false,
  },
  pro_annual: {
    key: "pro_annual",
    displayName: "Pro",
    uiLabel: "Pro annual",
    stripePriceEnvKey: "STRIPE_PRICE_PRO_ANNUAL",
    monthlyDisplayPriceNzd: 9,
    cvGenerationQuota: 100,
    quotaInterval: "monthly",
    family: "pro",
    variant: "annual",
    savingsPercentage: 53,
    paid: true,
    requiresTwelveMonthCommitment: true,
  },
  pro_monthly: {
    key: "pro_monthly",
    displayName: "Pro",
    uiLabel: "Pro monthly",
    stripePriceEnvKey: "STRIPE_PRICE_PRO_MONTHLY",
    monthlyDisplayPriceNzd: 19,
    cvGenerationQuota: 100,
    quotaInterval: "monthly",
    family: "pro",
    variant: "monthly",
    savingsPercentage: null,
    paid: true,
    requiresTwelveMonthCommitment: false,
  },
  premium_annual: {
    key: "premium_annual",
    displayName: "Premium",
    uiLabel: "Premium annual",
    stripePriceEnvKey: "STRIPE_PRICE_PREMIUM_ANNUAL",
    monthlyDisplayPriceNzd: 23,
    cvGenerationQuota: 350,
    quotaInterval: "monthly",
    family: "premium",
    variant: "annual",
    savingsPercentage: 41,
    paid: true,
    requiresTwelveMonthCommitment: true,
  },
  premium_monthly: {
    key: "premium_monthly",
    displayName: "Premium",
    uiLabel: "Premium monthly",
    stripePriceEnvKey: "STRIPE_PRICE_PREMIUM_MONTHLY",
    monthlyDisplayPriceNzd: 39,
    cvGenerationQuota: 350,
    quotaInterval: "monthly",
    family: "premium",
    variant: "monthly",
    savingsPercentage: null,
    paid: true,
    requiresTwelveMonthCommitment: false,
  },
} satisfies Record<PlanKey, PlanConfig>;

export const paidPlanKeys = Object.values(plans)
  .filter((plan) => plan.paid)
  .map((plan) => plan.key);

export function isPlanKey(value: string): value is PlanKey {
  return value in plans;
}

export function paidPlanFromSelection(
  family: Exclude<PlanFamily, "free">,
  variant: Exclude<PlanVariant, "free">
): PlanKey {
  return `${family}_${variant}` as PlanKey;
}

export function planDisplayPrice(planKey: PlanKey) {
  const plan = plans[planKey];
  return plan.monthlyDisplayPriceNzd === 0
    ? "NZ$0"
    : `NZ$${plan.monthlyDisplayPriceNzd}`;
}
