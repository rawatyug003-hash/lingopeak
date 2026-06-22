const prisma = require('../config/prisma');
const { ApiError } = require('../middleware/errorHandler');
const { createLearningProfileSchema } = require('../utils/validation');

async function listLanguages(req, res, next) {
  try {
    const languages = await prisma.language.findMany({ where: { isActive: true } });
    res.json({ languages });
  } catch (err) {
    next(err);
  }
}

async function createLearningProfile(req, res, next) {
  try {
    const data = createLearningProfileSchema.parse(req.body);

    const language = await prisma.language.findUnique({ where: { code: data.languageCode } });
    if (!language) {
      throw new ApiError(404, `Language with code "${data.languageCode}" not found`);
    }

    const profile = await prisma.learningProfile.upsert({
      where: { userId_languageId: { userId: req.userId, languageId: language.id } },
      update: {
        proficiencyLevel: data.proficiencyLevel,
        goalDescription: data.goalDescription,
        dailyGoalMinutes: data.dailyGoalMinutes,
      },
      create: {
        userId: req.userId,
        languageId: language.id,
        proficiencyLevel: data.proficiencyLevel || 'BEGINNER',
        goalDescription: data.goalDescription,
        dailyGoalMinutes: data.dailyGoalMinutes || 15,
      },
      include: { language: true },
    });

    res.status(201).json({ learningProfile: profile });
  } catch (err) {
    next(err);
  }
}

async function listMyLearningProfiles(req, res, next) {
  try {
    const profiles = await prisma.learningProfile.findMany({
      where: { userId: req.userId },
      include: { language: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ learningProfiles: profiles });
  } catch (err) {
    next(err);
  }
}

module.exports = { listLanguages, createLearningProfile, listMyLearningProfiles };
