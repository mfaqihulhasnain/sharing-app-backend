const prisma = require("../lib/prisma");

// Purpose: own database bootstrap and lifecycle for PostgreSQL via Prisma.
const connectDatabase = async () => {
  await prisma.$connect();
};

const disconnectDatabase = async () => {
  await prisma.$disconnect();
};

module.exports = { connectDatabase, disconnectDatabase };
