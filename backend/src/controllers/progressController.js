const prisma = require('../config/prisma');
const { ApiError } = require('../middleware/errorHandler');

// SM-2-inspired spaced repetition: quality is 0 (forgot) to 5 (perfect recall)
function calculateNextInterval({ intervalDays, easeFactor, quality }) {
  let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEaseFactor = Math.max(1.3, newEaseFactor);

  let newInterval;
  if (quality < 3) {
    newInterval = 1; // forgot it — reset to review again tomorrow
  } else if (intervalDays <= 1) {
    newInterval = 6;
  } else {
    newInterval = Math.round(intervalDays * newEaseFactor);
  }

  return { intervalDays: newInterval, easeFactor: newEaseFactor };
}

/**
 * Returns a batch of words the learner hasn't started tracking yet for this
 * learning profile, scoped to their current proficiency level (falls back
 * to easier levels if nothing is left at their exact level). This is what
 * powers "Learn new words" in the flashcard screen, as distinct from
 * "Review due words" which uses existing VocabularyProgress rows.
 */
async function getNewVocabulary(req, res, next) {
  try {
    const { learningProfileId, limit } = req.query;
    if (!learningProfileId) throw new ApiError(400, 'learningProfileId query param is required');

    const profile = await prisma.learningProfile.findFirst({
      where: { id: learningProfileId, userId: req.userId },
    });
    if (!profile) throw new ApiError(404, 'Learning profile not found');

    const alreadyTracked = await prisma.vocabularyProgress.findMany({
      where: { userId: req.userId, learningProfileId },
      select: { vocabularyItemId: true },
    });
    const trackedIds = alreadyTracked.map((p) => p.vocabularyItemId);

    const items = await prisma.vocabularyItem.findMany({
      where: {
        languageId: profile.languageId,
        id: { notIn: trackedIds },
        difficultyLevel: profile.proficiencyLevel,
      },
      take: Number(limit) || 10,
      orderBy: { createdAt: 'asc' },
    });

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Creates the first VocabularyProgress row for a word the learner has just
 * seen for the first time, with sane SM-2 defaults. Called once per word
 * when a learner starts a new flashcard session.
 */
async function startTrackingVocabulary(req, res, next) {
  try {
    const { vocabularyItemId, learningProfileId } = req.body;
    if (!vocabularyItemId || !learningProfileId) {
      throw new ApiError(400, 'vocabularyItemId and learningProfileId are required');
    }

    const profile = await prisma.learningProfile.findFirst({
      where: { id: learningProfileId, userId: req.userId },
    });
    if (!profile) throw new ApiError(404, 'Learning profile not found');

    const progress = await prisma.vocabularyProgress.upsert({
      where: { userId_vocabularyItemId: { userId: req.userId, vocabularyItemId } },
      update: {}, // already being tracked — leave existing progress untouched
      create: {
        userId: req.userId,
        learningProfileId,
        vocabularyItemId,
        nextReviewAt: new Date(), // due immediately so it shows up for review right away
      },
      include: { vocabularyItem: true },
    });

    res.status(201).json({ progress });
  } catch (err) {
    next(err);
  }
}

async function reviewVocabularyItem(req, res, next) {
  try {
    const { vocabularyItemId, quality } = req.body; // quality: 0-5

    if (typeof quality !== 'number' || quality < 0 || quality > 5) {
      throw new ApiError(400, 'quality must be a number between 0 and 5');
    }

    const progress = await prisma.vocabularyProgress.findFirst({
      where: { userId: req.userId, vocabularyItemId },
    });
    if (!progress) throw new ApiError(404, 'Vocabulary progress record not found');

    const { intervalDays, easeFactor } = calculateNextInterval({
      intervalDays: progress.intervalDays,
      easeFactor: progress.easeFactor,
      quality,
    });

    const nextReviewAt = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
    const isCorrect = quality >= 3;

    const updated = await prisma.vocabularyProgress.update({
      where: { id: progress.id },
      data: {
        timesReviewed: { increment: 1 },
        timesCorrect: isCorrect ? { increment: 1 } : undefined,
        intervalDays,
        easeFactor,
        nextReviewAt,
        masteredAt: intervalDays >= 30 ? new Date() : progress.masteredAt,
      },
    });

    res.json({ progress: updated });
  } catch (err) {
    next(err);
  }
}

async function getDueVocabulary(req, res, next) {
  try {
    const { learningProfileId } = req.query;
    if (!learningProfileId) throw new ApiError(400, 'learningProfileId query param is required');

    const due = await prisma.vocabularyProgress.findMany({
      where: {
        userId: req.userId,
        learningProfileId,
        nextReviewAt: { lte: new Date() },
      },
      include: { vocabularyItem: true },
      orderBy: { nextReviewAt: 'asc' },
      take: 20,
    });

    res.json({ dueItems: due });
  } catch (err) {
    next(err);
  }
}

async function getProgressSummary(req, res, next) {
  try {
    const { learningProfileId } = req.params;

    const profile = await prisma.learningProfile.findFirst({
      where: { id: learningProfileId, userId: req.userId },
    });
    if (!profile) throw new ApiError(404, 'Learning profile not found');

    const [totalWords, masteredWords, conversationCount] = await Promise.all([
      prisma.vocabularyProgress.count({ where: { userId: req.userId, learningProfileId } }),
      prisma.vocabularyProgress.count({
        where: { userId: req.userId, learningProfileId, masteredAt: { not: null } },
      }),
      prisma.conversation.count({ where: { userId: req.userId, learningProfileId } }),
    ]);

    res.json({
      summary: {
        proficiencyLevel: profile.proficiencyLevel,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        totalMinutesSpent: profile.totalMinutesSpent,
        totalWords,
        masteredWords,
        conversationCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  reviewVocabularyItem,
  getDueVocabulary,
  getNewVocabulary,
  startTrackingVocabulary,
  getProgressSummary,
};
