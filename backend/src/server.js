require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');
const { webhook } = require('./controllers/billingController');

const authRoutes = require('./routes/auth');
const learningProfileRoutes = require('./routes/learningProfiles');
const conversationRoutes = require('./routes/conversations');
const billingRoutes = require('./routes/billing');
const progressRoutes = require('./routes/progress');
const voiceRoutes = require('./routes/voice');

// ------------------------------------------------------------------
// Fail fast and loud if required env vars are missing, instead of
// limping along and throwing confusing errors deep inside a request.
// ------------------------------------------------------------------
const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('\n[LingoPeak] Cannot start \u2014 missing required environment variables:');
  missing.forEach((key) => console.error(`  - ${key}`));
  console.error('\nCopy .env.example to .env and fill these in, then try again.\n');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[LingoPeak] Warning: ANTHROPIC_API_KEY is not set. The AI tutor endpoint will fail until you add it to .env.');
}
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn('[LingoPeak] Warning: Razorpay keys are not set. Billing endpoints will fail until you add them to .env.');
}

const app = express();

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));

// Razorpay webhook needs the raw request body for HMAC signature
// verification, so it must be registered BEFORE express.json() and bypass
// the global JSON parser entirely.
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), webhook);

app.use(express.json({ limit: '2mb' }));

// General API rate limit (auth routes layer on a tighter limit of their own)
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/learning-profiles', learningProfileRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/voice', voiceRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`\n[LingoPeak] API running on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
  console.log(`[LingoPeak] CORS allowed origin: ${allowedOrigin}`);
  console.log(`[LingoPeak] Health check: http://localhost:${PORT}/health\n`);
});

// Surface unexpected crashes clearly instead of dying silently
process.on('unhandledRejection', (err) => {
  console.error('[LingoPeak] Unhandled promise rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('[LingoPeak] Uncaught exception:', err);
  server.close(() => process.exit(1));
});

module.exports = app;
