import prisma from "../../src/lib/prisma.js";
import { connectDatabase, disconnectDatabase } from "../../src/config/db.js";

const getActiveDatabaseUrl = () => process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

const assertSafeTestDatabase = () => {
  const activeDatabaseUrl = getActiveDatabaseUrl().toLowerCase();

  if (!activeDatabaseUrl) {
    throw new Error("No test database URL configured.");
  }

  if (process.env.TEST_DATABASE_URL) {
    return;
  }

  // Fallback support: allow DATABASE_URL only when it looks explicitly test/local.
  const isLikelyTestDatabase =
    activeDatabaseUrl.includes("localhost") ||
    activeDatabaseUrl.includes("127.0.0.1") ||
    activeDatabaseUrl.includes("test");

  if (!isLikelyTestDatabase) {
    throw new Error(
      "Refusing to run integration tests against DATABASE_URL without TEST_DATABASE_URL."
    );
  }
};

const resetDatabase = async () => {
  await prisma.$transaction([
    prisma.shareFile.deleteMany({}),
    prisma.shareRecipient.deleteMany({}),
    prisma.share.deleteMany({}),
    prisma.emailVerificationToken.deleteMany({}),
    prisma.session.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);
};

const initializeTestDatabase = async () => {
  assertSafeTestDatabase();
  await connectDatabase();
};

const shutdownTestDatabase = async () => {
  await disconnectDatabase();
};

export { initializeTestDatabase, resetDatabase, shutdownTestDatabase, prisma };
