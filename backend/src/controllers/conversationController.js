const prisma = require('../config/prisma');
const { ApiError } = require('../middleware/errorHandler');
const { sendMessageSchema } = require('../utils/validation');
const { getTutorReply } = require('../services/aiTutorService');
const { assertWithinUsageLimit, recordUsage } = require('../services/usageService');

const HISTORY_WINDOW = 20; // most recent messages sent to the model for context

async function sendMessage(req, res, next) {
  try {
    const data = sendMessageSchema.parse(req.body);

    const subscription = await prisma.subscription.findUnique({ where: { userId: req.userId } });
    if (!subscription || !['TRIALING', 'ACTIVE'].includes(subscription.status)) {
      throw new ApiError(403, 'An active subscription or trial is required to use the AI tutor');
    }
    await assertWithinUsageLimit(req.userId, subscription);

    const learningProfile = await prisma.learningProfile.findFirst({
      where: { id: data.learningProfileId, userId: req.userId },
      include: { language: true },
    });
    if (!learningProfile) {
      throw new ApiError(404, 'Learning profile not found');
    }

    // Find or create the conversation
    let conversation;
    if (data.conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { id: data.conversationId, userId: req.userId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: HISTORY_WINDOW } },
      });
      if (!conversation) throw new ApiError(404, 'Conversation not found');
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId: req.userId,
          learningProfileId: data.learningProfileId,
          topic: data.topic,
        },
        include: { messages: true },
      });
    }

    // Persist the learner's message first
    await prisma.message.create({
      data: { conversationId: conversation.id, role: 'USER', content: data.content },
    });

    const { replyText, feedback } = await getTutorReply({
      history: conversation.messages,
      userMessage: data.content,
      context: {
        languageName: learningProfile.language.name,
        proficiencyLevel: learningProfile.proficiencyLevel,
        topic: conversation.topic,
        goalDescription: learningProfile.goalDescription,
      },
    });

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: replyText,
        feedback: feedback || undefined,
      },
    });

    await recordUsage(req.userId);
    await prisma.learningProfile.update({
      where: { id: learningProfile.id },
      data: { lastPracticedAt: new Date() },
    });

    res.status(201).json({
      conversationId: conversation.id,
      message: assistantMessage,
    });
  } catch (err) {
    next(err);
  }
}

async function listConversations(req, res, next) {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.userId },
      orderBy: { startedAt: 'desc' },
      include: { learningProfile: { include: { language: true } } },
      take: 50,
    });
    res.json({ conversations });
  } catch (err) {
    next(err);
  }
}

async function getConversation(req, res, next) {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new ApiError(404, 'Conversation not found');
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
}

async function endConversation(req, res, next) {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!conversation) throw new ApiError(404, 'Conversation not found');

    const durationSeconds = Math.round((Date.now() - conversation.startedAt.getTime()) / 1000);

    const updated = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: 'COMPLETED', endedAt: new Date(), durationSeconds },
    });

    res.json({ conversation: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendMessage, listConversations, getConversation, endConversation };
