const prisma = require('../config/prisma');
const { ApiError } = require('../middleware/errorHandler');
const { analyzePronunciation } = require('../services/pronunciationService');
const { z } = require('zod');

const checkPronunciationSchema = z.object({
  learningProfileId: z.string().uuid(),
  targetPhrase: z.string().min(1).max(300),
  transcribedSpeech: z.string().min(1).max(500),
});

async function checkPronunciation(req, res, next) {
  try {
    const data = checkPronunciationSchema.parse(req.body);

    const learningProfile = await prisma.learningProfile.findFirst({
      where: { id: data.learningProfileId, userId: req.userId },
      include: { language: true },
    });
    if (!learningProfile) throw new ApiError(404, 'Learning profile not found');

    const result = await analyzePronunciation({
      targetPhrase: data.targetPhrase,
      transcribedSpeech: data.transcribedSpeech,
      languageName: learningProfile.language.name,
      proficiencyLevel: learningProfile.proficiencyLevel,
    });

    res.json({ result });
  } catch (err) {
    next(err);
  }
}

// A small built-in phrase bank so the voice practice feature works without
// any extra content-authoring step. Organized by language code and level.
const PHRASE_BANK = {
  es: {
    BEGINNER: ['Hola, ¿cómo estás?', 'Me llamo Ana.', '¿Dónde está el baño?', 'Quiero un café, por favor.'],
    INTERMEDIATE: ['¿Podrías ayudarme a encontrar la estación?', 'Ayer fui al mercado con mi hermana.'],
    ADVANCED: ['Si hubiera sabido, habría llegado antes.', 'A pesar de la lluvia, decidimos salir.'],
  },
  fr: {
    BEGINNER: ['Bonjour, comment ça va?', "Je m'appelle Claire.", 'Où sont les toilettes?'],
    INTERMEDIATE: ["Pourriez-vous m'aider à trouver la gare?", "Hier, je suis allé au marché."],
    ADVANCED: ["Si j'avais su, je serais arrivé plus tôt.", "Malgré la pluie, nous avons décidé de sortir."],
  },
  de: {
    BEGINNER: ['Hallo, wie geht es dir?', 'Ich heiße Max.', 'Wo ist die Toilette?'],
    INTERMEDIATE: ['Könnten Sie mir helfen, den Bahnhof zu finden?', 'Gestern war ich mit meiner Schwester auf dem Markt.'],
    ADVANCED: ['Wenn ich es gewusst hätte, wäre ich früher angekommen.', 'Trotz des Regens haben wir uns entschieden auszugehen.'],
  },
  ja: {
    BEGINNER: ['こんにちは、お元気ですか？', '私の名前はゆきです。', 'トイレはどこですか？'],
    INTERMEDIATE: ['駅までの道を教えてもらえますか？', '昨日、姉と市場に行きました。'],
    ADVANCED: ['知っていたら、もっと早く着いていたでしょう。', '雨にもかかわらず、出かけることにしました。'],
  },
  zh: {
    BEGINNER: ['你好，你好吗？', '我叫小明。', '洗手间在哪里？'],
    INTERMEDIATE: ['你能帮我找到车站吗？', '昨天我和姐姐去了市场。'],
    ADVANCED: ['如果我早知道，我会早点到的。', '尽管下雨，我们还是决定出去。'],
  },
  it: {
    BEGINNER: ['Ciao, come stai?', 'Mi chiamo Marco.', 'Dov\u2019è il bagno?'],
    INTERMEDIATE: ['Potresti aiutarmi a trovare la stazione?', 'Ieri sono andato al mercato con mia sorella.'],
    ADVANCED: ['Se avessi saputo, sarei arrivato prima.', 'Nonostante la pioggia, abbiamo deciso di uscire.'],
  },
};

async function getPracticePhrase(req, res, next) {
  try {
    const { learningProfileId } = req.query;
    if (!learningProfileId) throw new ApiError(400, 'learningProfileId query param is required');

    const learningProfile = await prisma.learningProfile.findFirst({
      where: { id: learningProfileId, userId: req.userId },
      include: { language: true },
    });
    if (!learningProfile) throw new ApiError(404, 'Learning profile not found');

    const languagePhrases = PHRASE_BANK[learningProfile.language.code];
    if (!languagePhrases) {
      throw new ApiError(404, `No practice phrases available yet for ${learningProfile.language.name}`);
    }

    // Map fine-grained levels down to the 3 buckets the phrase bank uses
    const levelBucket = ['BEGINNER', 'ELEMENTARY'].includes(learningProfile.proficiencyLevel)
      ? 'BEGINNER'
      : ['INTERMEDIATE', 'UPPER_INTERMEDIATE'].includes(learningProfile.proficiencyLevel)
      ? 'INTERMEDIATE'
      : 'ADVANCED';

    const phrases = languagePhrases[levelBucket];
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];

    res.json({
      phrase,
      languageCode: learningProfile.language.code,
      languageName: learningProfile.language.name,
      level: levelBucket,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { checkPronunciation, getPracticePhrase };
