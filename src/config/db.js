import prisma from "../lib/prisma.js";

// Purpose: own database bootstrap and lifecycle for PostgreSQL via Prisma.
const connectDatabase = async () => {
  await prisma.$connect();
};

const disconnectDatabase = async () => {
  await prisma.$disconnect();
};

export { connectDatabase, disconnectDatabase };
