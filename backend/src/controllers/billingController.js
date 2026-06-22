const prisma = require('../config/prisma');
const { ApiError } = require('../middleware/errorHandler');
const { createCheckoutSessionSchema } = require('../utils/validation');
const {
  createSubscription,
  cancelSubscription,
  verifyWebhookSignature,
  handleWebhookEvent,
} = require('../services/razorpayService');

async function startCheckout(req, res, next) {
  try {
    const { tier, billingInterval } = createCheckoutSessionSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { subscription: true },
    });

    const subscription = await createSubscription({ user, tier, billingInterval });

    // The frontend redirects the browser to this URL to complete payment
    // (card / UPI / netbanking — Razorpay's hosted checkout handles all of it)
    res.json({
      subscriptionId: subscription.id,
      checkoutUrl: subscription.short_url,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    next(err);
  }
}

async function cancelMySubscription(req, res, next) {
  try {
    const subscription = await prisma.subscription.findUnique({ where: { userId: req.userId } });
    if (!subscription?.razorpaySubscriptionId) {
      throw new ApiError(400, 'No active paid subscription found for this account');
    }

    await cancelSubscription(subscription.razorpaySubscriptionId);

    res.json({ message: 'Subscription canceled. You will keep access until the end of the current billing period.' });
  } catch (err) {
    next(err);
  }
}

// IMPORTANT: this route receives the *raw* request body (configured in
// server.js with express.raw()) because the webhook signature is computed
// over the exact raw bytes Razorpay sent.
async function webhook(req, res) {
  const signature = req.headers['x-razorpay-signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing X-Razorpay-Signature header' });
  }

  let isValid;
  try {
    isValid = verifyWebhookSignature(req.body, signature);
  } catch (err) {
    console.error('Razorpay webhook signature check failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (!isValid) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }

  try {
    await handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err) {
    console.error('Error handling Razorpay webhook event:', err);
    // Returning 500 tells Razorpay to retry the webhook later
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

module.exports = { startCheckout, cancelMySubscription, webhook };
