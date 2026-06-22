const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-6';

/**
 * Analyzes a learner's spoken (browser-transcribed) sentence against what
 * they were prompted to say, and returns structured pronunciation/grammar
 * feedback. This is text-based analysis of a speech-to-text transcript, not
 * audio waveform analysis \u2014 see the README note on accuracy tradeoffs.
 */
async function analyzePronunciation({ targetPhrase, transcribedSpeech, languageName, proficiencyLevel }) {
  const systemPrompt = `You are a ${languageName} pronunciation coach. The learner was asked to say a target phrase out loud. Their speech was transcribed by speech-to-text software, so minor transcription quirks (not necessarily pronunciation errors) may appear \u2014 use judgment to tell the two apart.

Respond with ONLY a JSON object, no other text, no markdown fences, in this exact shape:
{
  "score": <integer 0-100, overall closeness to the target phrase>,
  "transcriptMatchesTarget": <boolean, true if the words spoken match the target regardless of accent>,
  "likelyIssues": [<short strings describing likely pronunciation issues inferred from spelling/phonetic patterns in the transcript, empty array if none detected>],
  "encouragement": "<one short, specific, warm sentence of feedback>"
}`;

  const userMessage = `Target phrase (${proficiencyLevel} level): "${targetPhrase}"\nWhat the learner's speech was transcribed as: "${transcribedSpeech}"`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  try {
    return JSON.parse(rawText);
  } catch {
    // If the model wraps the JSON in fences despite instructions, strip and retry once
    const stripped = rawText.replace(/```json|```/g, '').trim();
    return JSON.parse(stripped);
  }
}

module.exports = { analyzePronunciation };
