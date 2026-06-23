// Mirrors LingoPeak's real India pricing (INR), set after market research
// comparing against Duolingo Super's India pricing (~\u20b9566/mo).
// monthlyMinutesLimit: -1 means unlimited.

const SUBSCRIPTION_TIERS = {
  FREE: {
    name: 'Free Trial',
    priceMonthlyINR: 0,
    priceAnnualINR: 0,
    monthlyMinutesLimit: 15,
    features: ['basic_vocabulary', 'progress_tracking'],
  },
  STARTER: {
    name: 'Starter',
    priceMonthlyINR: 599,
    priceAnnualINR: 5749, // ~20% off vs. 599*12 = 7188
    monthlyMinutesLimit: 50,
    features: ['basic_vocabulary', 'progress_tracking', 'mobile_app'],
  },
  PRO: {
    name: 'Pro',
    priceMonthlyINR: 1199,
    priceAnnualINR: 11499, // ~20% off vs. 1199*12 = 14388
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
    priceMonthlyINR: 2199,
    priceAnnualINR: 21099, // ~20% off vs. 2199*12 = 26388
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

const ANNUAL_DISCOUNT_PERCENT = 20;

function getMinutesLimit(tier) {
  return SUBSCRIPTION_TIERS[tier]?.monthlyMinutesLimit ?? 0;
}

function hasUnlimitedMinutes(tier) {
  return getMinutesLimit(tier) === -1;
}

module.exports = { SUBSCRIPTION_TIERS, ANNUAL_DISCOUNT_PERCENT, getMinutesLimit, hasUnlimitedMinutes };
