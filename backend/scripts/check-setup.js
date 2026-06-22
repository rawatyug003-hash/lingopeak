// Run with: npm run check-setup
// Validates your .env and database connection BEFORE you try to start the
// real server, so problems show up as one clear message instead of a stack
// trace halfway through a request.

require('dotenv').config();

const checks = [];
let hasFailure = false;

function check(name, fn) {
  try {
    const result = fn();
    checks.push({ name, ok: true, detail: result });
  } catch (err) {
    checks.push({ name, ok: false, detail: err.message });
    hasFailure = true;
  }
}

function checkEnvVar(key, { required = true } = {}) {
  const value = process.env[key];
  if (!value) {
    if (required) throw new Error('missing from .env');
    return 'not set (optional, feature will be disabled until added)';
  }
  return 'set';
}

console.log('\n=== LingoPeak setup check ===\n');

check('.env file loaded', () => {
  if (Object.keys(process.env).length === 0) throw new Error('.env not found or empty \u2014 did you copy .env.example to .env?');
  return 'ok';
});

check('DATABASE_URL', () => checkEnvVar('DATABASE_URL'));
check('JWT_SECRET', () => checkEnvVar('JWT_SECRET'));
check('JWT_REFRESH_SECRET', () => checkEnvVar('JWT_REFRESH_SECRET'));
check('ANTHROPIC_API_KEY (AI tutor + pronunciation)', () => checkEnvVar('ANTHROPIC_API_KEY', { required: false }));
check('RAZORPAY_KEY_ID (payments)', () => checkEnvVar('RAZORPAY_KEY_ID', { required: false }));
check('RAZORPAY_KEY_SECRET (payments)', () => checkEnvVar('RAZORPAY_KEY_SECRET', { required: false }));
check('FRONTEND_URL', () => checkEnvVar('FRONTEND_URL', { required: false }));

checks.forEach(({ name, ok, detail }) => {
  console.log(`${ok ? '\u2713' : '\u2717'} ${name}: ${detail}`);
});

// Try an actual DB connection if DATABASE_URL is present
async function checkDatabase() {
  if (!process.env.DATABASE_URL) return;

  console.log('\nTesting database connection...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    console.log('\u2713 Database connection: OK\n');
    await prisma.$disconnect();
  } catch (err) {
    console.log(`\u2717 Database connection: FAILED\n  ${err.message}\n`);
    console.log('  Common fixes:');
    console.log('  - Did you run "npx prisma migrate dev" yet?');
    console.log('  - Is your DATABASE_URL copied correctly from Railway (no extra quotes/spaces)?');
    console.log('  - Is the Railway Postgres instance actually running?\n');
    hasFailure = true;
  }
}

checkDatabase().then(() => {
  console.log('=== Summary ===');
  if (hasFailure) {
    console.log('\u2717 Some checks failed. Fix the issues above before running "npm run dev".\n');
    process.exit(1);
  } else {
    console.log('\u2713 All checks passed. You are good to run "npm run dev".\n');
    process.exit(0);
  }
});
