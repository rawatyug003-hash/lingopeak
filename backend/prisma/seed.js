// Run with: npm run prisma:seed
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Matches Section 9.1 "Languages Section" of the business plan
const LANGUAGES = [
  { code: 'es', name: 'Spanish', nativeName: 'Espa\u00f1ol', flagEmoji: '\ud83c\uddea\ud83c\uddf8' },
  { code: 'fr', name: 'French', nativeName: 'Fran\u00e7ais', flagEmoji: '\ud83c\uddeb\ud83c\uddf7' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flagEmoji: '\ud83c\udde9\ud83c\uddea' },
  { code: 'ja', name: 'Japanese', nativeName: '\u65e5\u672c\u8a9e', flagEmoji: '\ud83c\uddef\ud83c\uddf5' },
  { code: 'zh', name: 'Mandarin', nativeName: '\u4e2d\u6587', flagEmoji: '\ud83c\udde8\ud83c\uddf3' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flagEmoji: '\ud83c\uddee\ud83c\uddf9' },
];

const ACHIEVEMENTS = [
  { code: 'first_conversation', name: 'First Words', description: 'Completed your first AI conversation', iconEmoji: '\ud83d\udcac' },
  { code: 'streak_7', name: 'Week Warrior', description: 'Practiced 7 days in a row', iconEmoji: '\ud83d\udd25' },
  { code: 'streak_30', name: 'Monthly Master', description: 'Practiced 30 days in a row', iconEmoji: '\ud83c\udfc6' },
  { code: 'words_100', name: 'Century Club', description: 'Learned 100 vocabulary words', iconEmoji: '\ud83d\udcd6' },
  { code: 'words_500', name: 'Word Wizard', description: 'Learned 500 vocabulary words', iconEmoji: '\u2728' },
];

async function main() {
  for (const lang of LANGUAGES) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: lang,
      create: lang,
    });
  }
  console.log(`Seeded ${LANGUAGES.length} languages.`);

  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: achievement,
      create: achievement,
    });
  }
  console.log(`Seeded ${ACHIEVEMENTS.length} achievements.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
