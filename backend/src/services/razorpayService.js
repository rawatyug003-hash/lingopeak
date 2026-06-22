const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../config/prisma');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Razorpay Plan IDs — create these once in the Razorpay Dashboard
// (Subscriptions > Plans) and paste the plan_xxxxx IDs into your .env
const PLAN_ID_MAP = {
  STARTER_MONTHLY: process.env.RAZORPAY_PLAN_STARTER_MONTHLY,
  STARTER_ANNUAL: process.env.RAZORPAY_PLAN_STARTER_ANNUAL,
  PRO_MONTHLY: process.env.RAZORPAY_PLAN_PRO_MONTHLY,
  PRO_ANNUAL: process.env.RAZORPAY_PLAN_PRO_ANNUAL,
  PREMIUM_MONTHLY: process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY,
  PREMIUM_ANNUAL: process.env.RAZORPAY_PLAN_PREMIUM_ANNUAL,
};

const TOTAL_BILLING_CYCLES = 360; // effectively "until canceled" (30 years of months)

/**
 * Creates a Razorpay customer (if one doesn't exist yet) and a subscription
 * for that customer on the requested plan. The frontend uses the returned
 * subscription's short URL / id to open Razorpay's hosted checkout.
 */
async function createSubscription({ user, tier, billingInterval }) {
  const planId = PLAN_ID_MAP[`${tier}_${billingInterval}`];
  if (!planId) {
    throw new Error(`No Razorpay plan configured for ${tier} ${billingInterval}`);
  }

  let razorpayCustomerId = user.subscription?.razorpayCustomerId;
  if (!razorpayCustomerId) {
    const customer = await razorpay.customers.create({
      name: user.fullName,
      email: user.email,
      notes: { userId: user.id },
    });
    razorpayCustomerId = customer.id;
  }

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    total_count: TOTAL_BILLING_CYCLES,
    notes: { userId: user.id, tier },
  });

  await prisma.subscription.update({
    where: { userId: user.id },
    data: {
      razorpayCustomerId,
      razorpaySubscriptionId: subscription.id,
    },
  });

  // short_url is Razorpay's hosted checkout page — redirect the user here
  return subscription;
}

async function cancelSubscription(razorpaySubscriptionId) {
  return razorpay.subscriptions.cancel(razorpaySubscriptionId);
}

/**
 * Verifies the X-Razorpay-Signature header on incoming webhooks using HMAC
 * SHA256 with your webhook secret. This is the only way to trust that a
 * webhook actually came from Razorpay and wasn't forged.
 */
function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function handleWebhookEvent(event) {
  const payload = event.payload?.subscription?.entity;

  switch (event.event) {
    case 'subscription.activated': {
      const userId = payload.notes?.userId;
      const tier = payload.notes?.tier;
      if (!userId || !tier) break;

      await prisma.subscription.update({
        where: { userId },
        data: {
          tier,
          status: 'ACTIVE',
          razorpaySubscriptionId: payload.id,
          currentPeriodStart: new Date(payload.current_start * 1000),
          currentPeriodEnd: new Date(payload.current_end * 1000),
          monthlyMinutesLimit: tier === 'STARTER' ? 50 : -1,
        },
      });
      break;
    }

    case 'subscription.charged': {
      const existing = await prisma.subscription.findFirst({
        where: { razorpaySubscriptionId: payload.id },
      });
      if (!existing) break;

      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: new Date(payload.current_start * 1000),
          currentPeriodEnd: new Date(payload.current_end * 1000),
        },
      });
      break;
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      const existing = await prisma.subscription.findFirst({
        where: { razorpaySubscriptionId: payload.id },
      });
      if (!existing) break;

      await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: 'CANCELED', canceledAt: new Date(), tier: 'FREE', monthlyMinutesLimit: 15 },
      });
      break;
    }

    case 'subscription.pending': {
      // Payment failed/retry in progress — flag as past_due so we can warn the user in-app
      const existing = await prisma.subscription.findFirst({
        where: { razorpaySubscriptionId: payload.id },
      });
      if (!existing) break;

      await prisma.subscription.update({
        where: { id: existing.id },
        data: { status: 'PAST_DUE' },
      });
      break;
    }

    default:
      break;
  }
}

module.exports = {
  razorpay,
  createSubscription,
  cancelSubscription,
  verifyWebhookSignature,
  handleWebhookEvent,
};
