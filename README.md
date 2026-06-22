# LingoPeak

AI-powered language tutoring platform. This repo contains everything from your business plan turned into a working stack:

- **`/landing`** — static landing page + auth pages (signup/login/dashboard) matching your Design Philosophy & Brand Identity sections
- **`/backend`** — Node.js + Express API with PostgreSQL (via Prisma), JWT auth, Razorpay billing, AI tutor, and voice pronunciation practice

---

## 1. Quick start

### Prerequisites
- Node.js 18+ (you have v22, that's fine)
- A free [Railway](https://railway.app) account (for Postgres + hosting)
- An [Anthropic API key](https://console.anthropic.com) (for the AI tutor + pronunciation scoring)
- A [Razorpay](https://razorpay.com) account (for payments — can skip initially and add later)

### Step 1 — Get a database
1. Go to [railway.app](https://railway.app), sign in, click **New Project → Provision PostgreSQL**.
2. Click the Postgres service → **Variables** tab → copy the `DATABASE_URL` value.

### Step 2 — Set up the backend
```bash
cd backend
npm install
cp .env.example .env
```
Open `.env` and fill in:
- `DATABASE_URL` from Railway
- `ANTHROPIC_API_KEY` from console.anthropic.com
- Two random long strings for `JWT_SECRET` and `JWT_REFRESH_SECRET` — generate each with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- Razorpay keys (see Section 3 below — can leave as placeholders for now if you're not testing billing yet)

Then **check your setup before running anything**:
```bash
npm run check-setup
```
This validates your `.env` and tests the actual database connection, and tells you exactly what's wrong if something fails — instead of a confusing crash later.

Once that passes:
```bash
npx prisma migrate dev --name init   # creates all tables in your database
npm run prisma:seed                  # adds the 6 languages + achievements
npm run dev                          # starts the API on http://localhost:3001
```

Visit `http://localhost:3001/health` — you should see `{"status":"ok"}`.

### Step 3 — Open the landing page + app
```bash
cd landing
npx serve .
```
Then visit:
- `/index.html` — landing page
- `/app/signup.html` — create an account
- `/app/login.html` — log in
- `/app/dashboard.html` — logout button + voice pronunciation practice

If you open these as plain `file://` paths instead of through a local server, the API calls will still work (CORS is configured for `http://localhost:5173` by default — update `FRONTEND_URL` in `.env` if you serve on a different port).

---

## 2. What's actually in the backend

| Area | Files |
|---|---|
| Database schema | `backend/prisma/schema.prisma` |
| Auth (signup/login/logout/refresh) | `controllers/authController.js`, `routes/auth.js` |
| Learning profiles (which language a user studies) | `controllers/learningProfileController.js` |
| AI tutor conversations | `services/aiTutorService.js`, `controllers/conversationController.js` |
| Voice pronunciation practice | `services/pronunciationService.js`, `controllers/voiceController.js` |
| Usage metering (Starter plan's 50 min/mo cap) | `services/usageService.js` |
| Razorpay billing & webhooks | `services/razorpayService.js`, `controllers/billingController.js` |
| Vocabulary spaced repetition + streaks | `controllers/progressController.js` |
| Setup validation | `scripts/check-setup.js` |

### API endpoints at a glance

```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/logout-all                 (requires auth) — logs out every device
GET    /api/auth/me                          (requires auth)

GET    /api/learning-profiles/languages
POST   /api/learning-profiles                (requires auth)
GET    /api/learning-profiles/me             (requires auth)

POST   /api/conversations/message            (requires auth) — main AI tutor chat
GET    /api/conversations                    (requires auth)
GET    /api/conversations/:id                (requires auth)
POST   /api/conversations/:id/end            (requires auth)

GET    /api/voice/practice-phrase            (requires auth) — random phrase for the picked language/level
POST   /api/voice/check-pronunciation        (requires auth) — score a transcribed attempt

POST   /api/billing/checkout                 (requires auth) — creates Razorpay subscription + checkout URL
POST   /api/billing/cancel                   (requires auth)
POST   /api/billing/webhook                  (Razorpay calls this directly)

GET    /api/progress/vocabulary/due          (requires auth)
POST   /api/progress/vocabulary/review       (requires auth)
GET    /api/progress/:learningProfileId/summary  (requires auth)
```

All authenticated requests need a header: `Authorization: Bearer <accessToken>`.

---

## 3. Setting up Razorpay (for receiving real payments)

Razorpay is the right choice for an India-based business — it settles directly to your Indian bank account and supports UPI/cards/netbanking, which Stripe in India does not do cleanly.

1. Sign up at [dashboard.razorpay.com/signup](https://dashboard.razorpay.com/signup). You can start in **Test Mode** with no KYC to develop against fake payments.
2. **Settings → API Keys → Generate Test Key** → copy `Key Id` and `Key Secret` into `.env` as `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
3. **Subscriptions → Plans → Create Plan** — make 6 plans, one per row:

   | Plan | Amount | Interval |
   |---|---|---|
   | Starter Monthly | ₹9.99 equivalent in INR | Monthly |
   | Starter Annual | ~17% off, billed yearly | Yearly |
   | Pro Monthly | ₹19.99 equivalent in INR | Monthly |
   | Pro Annual | ~17% off, billed yearly | Yearly |
   | Premium Monthly | ₹29.99 equivalent in INR | Monthly |
   | Premium Annual | ~17% off, billed yearly | Yearly |

   Copy each `plan_xxxxx` ID into the matching `RAZORPAY_PLAN_*` variable in `.env`.

   *(Pricing tip: your business plan prices in USD, but Razorpay needs INR. Pick a clean INR price like ₹799/₹1,599/₹2,399 rather than a literal currency conversion — round numbers convert better and your competitors' India pricing is in this range too.)*

4. **Settings → Webhooks → Add New Webhook**:
   - URL: `https://your-deployed-api-url.com/api/billing/webhook` (use [ngrok](https://ngrok.com) to test locally first)
   - Active events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.completed`, `subscription.pending`
   - Copy the **Webhook Secret** into `.env` as `RAZORPAY_WEBHOOK_SECRET`.
5. When ready for real money, complete KYC in the Razorpay dashboard (PAN card + bank account) and switch from Test keys to Live keys.

---

## 4. How the voice pronunciation feature works

There's no separate speech API cost here — it uses your **browser's built-in speech recognition** (free, built into Chrome/Edge) to turn speech into text, then sends that transcript to Claude to score it against the target phrase.

**To test it yourself:**
1. Sign up / log in through the app pages.
2. You need a `LearningProfile` for a language before scoring works (the dashboard's mic still works without one — it'll show you the transcript, just not a score). Create one with:
   ```bash
   curl -X POST http://localhost:3001/api/learning-profiles \
     -H "Authorization: Bearer <accessToken>" \
     -H "Content-Type: application/json" \
     -d '{"languageCode":"es","proficiencyLevel":"BEGINNER"}'
   ```
   Copy the returned `id` and paste it into the `currentLearningProfileId` variable in `dashboard.html` (or wire up a proper language-picker UI later — this is a quick wire-up to test the feature today).
3. Open the dashboard, pick a language, click "New phrase," then click the mic and say it out loud.

**Honest limitation:** this checks *what words you said* via speech-to-text + Claude's judgment, not real phoneme-level audio analysis. It catches a real and useful range of mistakes but isn't lab-grade accent scoring. If LingoPeak takes off, swapping in Azure Speech or a similar dedicated pronunciation API is a contained change to `pronunciationService.js`, not a rewrite.

---

## 5. Deploying for real

1. **Push this code to GitHub.**
2. **Backend → Railway**: New Project → Deploy from GitHub repo → root directory `/backend` → add all env vars from your local `.env`. Railway auto-detects Node and runs `npm start`.
3. **Run migrations against production**: `npx prisma migrate deploy`.
4. **Landing + app pages → Vercel or Netlify**: drag-and-drop the `landing` folder, or connect the GitHub repo.
5. **Update `FRONTEND_URL`** in your backend's Railway environment variables to your real deployed frontend URL (for CORS).
6. **Razorpay webhook**: point it at your real deployed `/api/billing/webhook` URL once live.

---

## 6. What's intentionally NOT built yet
- A proper in-app language picker (the dashboard hardcodes a quick wire-up — see Section 4)
- Live group sessions / 1-on-1 coaching booking system (Premium tier feature)
- Admin dashboard
- Email verification on signup (the `emailVerified` field exists in the schema but isn't enforced anywhere yet)

Tell me which matters most for your launch and I'll build it next.

