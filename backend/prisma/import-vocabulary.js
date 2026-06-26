// One-time import script: loads vocabulary content (from Manus) into the
// VocabularyItem table. Safe to run more than once \u2014 it skips any word
// that already exists for that language, so re-running won't create
// duplicates.
//
// This script ONLY touches the VocabularyItem table. It does not modify
// any other table, any existing code, or the database schema.
//
// HOW TO RUN (from the backend folder, with your real .env already set up):
//   1. Put lingopeak_all_languages_vocabulary.json in the backend/prisma folder
//   2. node prisma/import-vocabulary.js
//
// It prints a summary of what it added/skipped for each language when done.

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DATA_FILE = path.join(__dirname, 'lingopeak_all_languages_vocabulary.json');

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`\nCould not find ${DATA_FILE}`);
    console.error('Make sure lingopeak_all_languages_vocabulary.json is in the backend/prisma folder.\n');
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const data = JSON.parse(raw);

  console.log(`\nLoaded vocabulary file: ${data.description || 'untitled'}`);
  console.log(`Languages in file: ${Object.keys(data.languages).join(', ')}\n`);

  const summary = [];

  for (const [key, langData] of Object.entries(data.languages)) {
    const languageCode = langData.languageCode;

    const language = await prisma.language.findUnique({ where: { code: languageCode } });
    if (!language) {
      console.warn(`\u26a0  Skipping "${key}" \u2014 no Language row found for code "${languageCode}". Did you run the seed script?`);
      summary.push({ language: key, added: 0, skipped: 0, error: 'language not found in DB' });
      continue;
    }

    let added = 0;
    let skipped = 0;

    for (const item of langData.vocabulary) {
      // Idempotency check: does this exact word already exist for this language?
      const existing = await prisma.vocabularyItem.findFirst({
        where: { languageId: language.id, word: item.word },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.vocabularyItem.create({
        data: {
          languageId: language.id,
          word: item.word,
          translation: item.translation,
          exampleSentence: item.exampleSentence || null,
          difficultyLevel: item.difficultyLevel || 'BEGINNER',
        },
      });
      added++;
    }

    console.log(`${langData.language} (${languageCode}): added ${added}, skipped ${skipped} (already existed)`);
    summary.push({ language: langData.language, added, skipped });
  }

  console.log('\n=== Import complete ===');
  const totalAdded = summary.reduce((sum, s) => sum + (s.added || 0), 0);
  console.log(`Total new vocabulary items added: ${totalAdded}\n`);
}

main()
  .catch((err) => {
    console.error('\nImport failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
