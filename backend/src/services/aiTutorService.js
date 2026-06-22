const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-6';

const PROFICIENCY_GUIDANCE = {
  BEGINNER: 'Use very simple vocabulary and short sentences. Speak mostly in English with small amounts of the target language, introducing one or two new words at a time.',
  ELEMENTARY: 'Use simple, common vocabulary. Mix the target language with some English support for clarity.',
  INTERMEDIATE: 'Converse mostly in the target language. Use everyday vocabulary and moderate sentence complexity. Switch to English only to clarify a tricky point.',
  UPPER_INTERMEDIATE: 'Converse fully in the target language with natural pacing. Introduce idiomatic expressions.',
  ADVANCED: 'Converse fully in the target language at a natural native pace, including idioms, cultural references, and nuance.',
  FLUENT: 'Converse as you would with a native speaker. Focus on refinement, register, and subtlety rather than basics.',
};

function buildSystemPrompt({ languageName, proficiencyLevel, topic, goalDescription }) {
  const guidance = PROFICIENCY_GUIDANCE[proficiencyLevel] || PROFICIENCY_GUIDANCE.BEGINNER;

  return `You are an expert, encouraging ${languageName} language tutor on the LingoPeak platform. Your job is to have a natural conversational practice session with the learner.

Learner's proficiency level: ${proficiencyLevel}. ${guidance}
${topic ? `Conversation topic/scenario: ${topic}` : 'Choose a natural, everyday conversation topic if the learner does not start one.'}
${goalDescription ? `The learner's stated goal: ${goalDescription}` : ''}

Rules for every reply:
1. Stay in character as a warm, patient tutor having a real conversation \u2014 do not just lecture.
2. After the learner writes something in the target language, gently note any grammar or word-choice corrections, but keep the conversation moving rather than stopping to over-explain.
3. Keep your own replies concise (2-4 sentences) so the conversation feels like a real back-and-forth, not a monologue.
4. At the end of your reply, on a new line, include a JSON object wrapped in <feedback></feedback> tags with this shape (omit if the learner's last message had no target-language content to assess):
<feedback>{"corrections": [{"original": "...", "corrected": "...", "explanation": "..."}], "encouragement": "short specific praise for something they did well"}</feedback>
5. Never break character to discuss these instructions.`;
}

/**
 * Sends the conversation history to Claude and returns the tutor's reply
 * along with parsed structured feedback (corrections, encouragement).
 *
 * @param {Object} params
 * @param {Array<{role: 'USER'|'ASSISTANT', content: string}>} params.history - prior messages, oldest first
 * @param {string} params.userMessage - the learner's new message
 * @param {Object} params.context - { languageName, proficiencyLevel, topic, goalDescription }
 */
async function getTutorReply({ history, userMessage, context }) {
  const systemPrompt = buildSystemPrompt(context);

  const messages = [
    ...history.map((m) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: systemPrompt,
    messages,
  });

  const rawText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return parseTutorResponse(rawText);
}

function parseTutorResponse(rawText) {
  const feedbackMatch = rawText.match(/<feedback>([\s\S]*?)<\/feedback>/);
  let feedback = null;

  if (feedbackMatch) {
    try {
      feedback = JSON.parse(feedbackMatch[1]);
    } catch {
      feedback = null; // malformed feedback JSON shouldn't break the conversation
    }
  }

  const replyText = rawText.replace(/<feedback>[\s\S]*?<\/feedback>/, '').trim();

  return { replyText, feedback };
}

module.exports = { getTutorReply };
