const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { ApiError } = require('../middleware/errorHandler');
const { signupSchema, loginSchema } = require('../utils/validation');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/tokens');

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TRIAL_LENGTH_DAYS = 7; // matches "7-day free trial" in the business plan

async function issueTokenPair(userId) {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

async function signup(req, res, next) {
  try {
    const { email, password, fullName } = signupSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        subscription: {
          create: {
            tier: 'FREE',
            status: 'TRIALING',
            trialEndsAt: new Date(Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000),
            monthlyMinutesLimit: 15,
          },
        },
      },
      include: { subscription: true },
    });

    const tokens = await issueTokenPair(user.id);

    res.status(201).json({ user: sanitizeUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscription: true },
    });

    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new ApiError(401, 'Invalid email or password');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'This account has been deactivated');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await issueTokenPair(user.id);

    res.json({ user: sanitizeUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new ApiError(400, 'refreshToken is required');
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, 'Invalid or expired refresh token');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new ApiError(401, 'Refresh token is no longer valid');
    }

    // Rotate: revoke the old refresh token and issue a new pair
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    const tokens = await issueTokenPair(payload.userId);

    res.json(tokens);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken
        .updateMany({ where: { token: refreshToken }, data: { revoked: true } })
        .catch(() => {}); // logout should succeed even if token lookup fails
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

// Revokes every refresh token for the authenticated user \u2014 use for a
// "log out of all devices" button or after a suspected account compromise.
async function logoutAll(req, res, next) {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId: req.userId, revoked: false },
      data: { revoked: true },
    });
    res.json({ message: 'Logged out of all devices' });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { subscription: true, learningProfiles: { include: { language: true } } },
    });
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, refresh, logout, logoutAll, getMe };
