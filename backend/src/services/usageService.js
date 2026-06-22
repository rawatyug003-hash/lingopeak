const prisma = require('../config/prisma');
const { hasUnlimitedMinutes } = require('../config/tiers');
const { ApiError } = require('../middleware/errorHandler');

function getCurrentPeriodBounds() {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { periodStart, periodEnd };
}

async function getOrCreateUsageRecord(userId) {
  const { periodStart, periodEnd } = getCurrentPeriodBounds();

  return prisma.usageRecord.upsert({
    where: { userId_periodStart: { userId, periodStart } },
    update: {},
    create: { userId, periodStart, periodEnd, minutesUsed: 0, messagesCount: 0 },
  });
}

/**
 * Throws if the user has exceeded their plan's monthly AI conversation minutes.
 * Each text exchange is approximated as costing a small, fixed number of
 * minutes since this is text chat rather than a timed voice call.
 */
async function assertWithinUsageLimit(userId, subscription) {
  if (hasUnlimitedMinutes(subscription.tier)) return;

  const usage = await getOrCreateUsageRecord(userId);
  if (usage.minutesUsed >= subscription.monthlyMinutesLimit) {
    throw new ApiError(
      403,
      `You've used all ${subscription.monthlyMinutesLimit} minutes included in your plan this month. Upgrade to Pro for unlimited AI conversation practice.`
    );
  }
}

const MINUTES_PER_EXCHANGE = 0.5; // rough estimate per user message + tutor reply

async function recordUsage(userId) {
  const { periodStart } = getCurrentPeriodBounds();

  await prisma.usageRecord.update({
    where: { userId_periodStart: { userId, periodStart } },
    data: {
      minutesUsed: { increment: MINUTES_PER_EXCHANGE },
      messagesCount: { increment: 1 },
    },
  });
}

module.exports = { assertWithinUsageLimit, recordUsage, getOrCreateUsageRecord };
