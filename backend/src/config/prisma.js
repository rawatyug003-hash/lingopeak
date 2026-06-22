const { PrismaClient } = require('@prisma/client');

// Reuse a single PrismaClient instance across the app (important in dev with
// nodemon reloads, and prevents exhausting the DB connection pool).
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
