// Mirrors the pricing tiers from the LingoPeak business plan (Section 5).
// monthlyMinutesLimit: -1 means unlimited.

const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free Trial',
    priceMonthly: 0,
    monthlyMinutesLimit: 15,
    features: ['basic_vocabulary', 'progress_tracking'],
  },
  STARTER: {
    name: 'Starter',
    priceMonthly: 9.99,
    monthlyMinutesLimit: 50,
    features: ['basic_vocabulary', 'progress_tracking', 'mobile_app'],
  },
  PRO: {
    name: 'Pro',
    priceMonthly: 19.99,
    monthlyMinutesLimit: -1, // unlimited
    features: [
      'personalized_paths',
      'pronunciation_feedback',
      'real_world_content',
      'priority_support',
    ],
  },
  PREMIUM: {
    name: 'Premium',
    priceMonthly: 29.99,
    monthlyMinutesLimit: -1, // unlimited
    features: [
      'personalized_paths',
      'pronunciation_feedback',
      'real_world_content',
      'priority_support',
      'live_sessions',
      'certification_exams',
      'advanced_analytics',
      'one_on_one_coaching',
    ],
  },
};

const ANNUAL_DISCOUNT_PERCENT = 17; // within the doc's stated 15-20% range

function getMinutesLimit(tier) {
  return SUBSCRIPTION_TIERS[tier]?.monthlyMinutesLimit ?? 0;
}

function hasUnlimitedMinutes(tier) {
  return getMinutesLimit(tier) === -1;
}

module.exports = { SUBSCRIPTION_TIERS, ANNUAL_DISCOUNT_PERCENT, getMinutesLimit, hasUnlimitedMinutes };
