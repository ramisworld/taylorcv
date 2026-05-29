import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadDotEnv() {
  const envFile = readFileSync(".env", "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = valueParts.join("=").trim().replace(/^"|"$/g, "");
  }
}

loadDotEnv();
process.env.NODE_ENV = "test";
process.env.USE_MOCK_AI = "true";
process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || "test-better-auth-secret-test-better-auth-secret";
process.env.ABUSE_HASH_SECRET =
  process.env.ABUSE_HASH_SECRET || "test-abuse-hash-secret-test-abuse-hash-secret";

const { PrismaClient } = await import("../generated/prisma/index.js");
const { plans, paidPlanFromSelection } = await import("../src/lib/plans.ts");

assert.equal(paidPlanFromSelection("pro", "annual"), "pro_annual");
assert.equal(paidPlanFromSelection("premium", "monthly"), "premium_monthly");
assert.equal(plans.free.cvGenerationQuota, 1);
assert.equal(plans.free.quotaInterval, "one_time");
assert.equal(plans.pro_annual.monthlyDisplayPriceNzd, 9);
assert.equal(plans.pro_annual.cvGenerationQuota, 100);
assert.equal(plans.pro_annual.requiresTwelveMonthCommitment, true);
assert.equal(plans.pro_monthly.requiresTwelveMonthCommitment, false);
assert.equal(plans.premium_annual.savingsPercentage, 41);
assert.equal(plans.premium_monthly.cvGenerationQuota, 350);

const landingSource = readFileSync("src/components/landing/LandingPage.tsx", "utf8");
assert.equal(landingSource.includes("billed yearly"), false);
assert.equal(landingSource.includes("12-month commitment"), false);
assert.equal(/cancel anytime/i.test(landingSource), false);
assert.equal(landingSource.includes("Smart plans for every stage of"), true);
assert.equal(landingSource.includes("Annual plan"), true);
assert.equal(landingSource.includes("Save up to 53%"), true);

const prisma = new PrismaClient();
const userId = `billing-test-${Date.now()}`;
try {
  await prisma.user.create({
    data: {
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: "Billing Test",
    },
  });
  let used = await prisma.cvGenerationUsage.count({
    where: { userId, planKey: "free" },
  });
  assert.equal(plans.free.cvGenerationQuota - used, 1);

  const anonymousSession = await prisma.anonymousSession.create({
    data: { id: `${userId}-anon` },
  });
  const application = await prisma.application.create({
    data: {
      anonymousSessionId: anonymousSession.id,
      userId,
      status: "started",
      currentStep: "started",
    },
  });
  await prisma.cvGenerationUsage.create({
    data: {
      userId,
      applicationId: application.id,
      planKey: "free",
    },
  });
  used = await prisma.cvGenerationUsage.count({
    where: { userId, planKey: "free" },
  });
  assert.equal(plans.free.cvGenerationQuota - used, 0);
} finally {
  await prisma.cvGenerationUsage.deleteMany({ where: { userId } });
  await prisma.application.deleteMany({ where: { userId } });
  await prisma.billingAccount.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.anonymousSession.deleteMany({ where: { id: `${userId}-anon` } });
  await prisma.$disconnect();
}

console.log("billing/entitlement tests passed");
