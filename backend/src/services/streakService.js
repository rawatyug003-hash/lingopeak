const prisma = require('../config/prisma');

function isSameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isYesterday(date, reference) {
  const yesterday = new Date(reference);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameCalendarDay(date, yesterday);
}

/**
 * Call this any time a user does a practice action (sends an AI tutor
 * message, completes a pronunciation check, reviews vocabulary). Updates
 * the streak counters based on whether today continues, restarts, or
 * repeats an existing streak \u2014 and bumps totalMinutesSpent / lastPracticedAt.
 *
 * Designed to be safe to call multiple times in the same day (idempotent
 * for streak purposes \u2014 only the first practice of a new day increments it).
 */
async function recordPracticeActivity(learningProfileId, { minutesSpent = 0 } = {}) {
  const profile = await prisma.learningProfile.findUnique({ where: { id: learningProfileId } });
  if (!profile) return null;

  const now = new Date();
  let { currentStreak, longestStreak, lastPracticedAt } = profile;

  if (!lastPracticedAt) {
    // First practice session ever
    currentStreak = 1;
  } else if (isSameCalendarDay(lastPracticedAt, now)) {
    // Already practiced today \u2014 streak doesn't change, just don't double-count
  } else if (isYesterday(lastPracticedAt, now)) {
    // Practiced yesterday, practicing again today \u2014 streak continues
    currentStreak = currentStreak + 1;
  } else {
    // Gap of 2+ days \u2014 streak resets
    currentStreak = 1;
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  return prisma.learningProfile.update({
    where: { id: learningProfileId },
    data: {
      currentStreak,
      longestStreak,
      lastPracticedAt: now,
      totalMinutesSpent: { increment: minutesSpent },
    },
  });
}

module.exports = { recordPracticeActivity };
