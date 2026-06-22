const { z } = require('zod');

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required').max(100),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const createLearningProfileSchema = z.object({
  languageCode: z.string().min(2).max(5),
  proficiencyLevel: z
    .enum(['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'ADVANCED', 'FLUENT'])
    .optional(),
  goalDescription: z.string().max(500).optional(),
  dailyGoalMinutes: z.number().int().min(5).max(180).optional(),
});

const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(), // omit to start a new conversation
  learningProfileId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  topic: z.string().max(200).optional(),
});

const createCheckoutSessionSchema = z.object({
  tier: z.enum(['STARTER', 'PRO', 'PREMIUM']),
  billingInterval: z.enum(['MONTHLY', 'ANNUAL']),
});

module.exports = {
  signupSchema,
  loginSchema,
  createLearningProfileSchema,
  sendMessageSchema,
  createCheckoutSessionSchema,
};
