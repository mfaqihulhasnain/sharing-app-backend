import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_PASSWORD = "Password@123";
const SALT_ROUNDS = 10;

const usersSeed = [
  {
    name: "You",
    email: "you@nearboards.local",
  },
  {
    name: "Ali",
    email: "ali@nearboards.local",
  },
  {
    name: "Sara",
    email: "sara@nearboards.local",
  },
  {
    name: "Maya",
    email: "maya@nearboards.local",
  },
  {
    name: "Ahmed",
    email: "ahmed@nearboards.local",
  },
  {
    name: "Noah",
    email: "noah@nearboards.local",
  },
];

const sharesSeed = [
  {
    senderEmail: "ali@nearboards.local",
    createdAt: "2026-04-16T09:14:00+05:00",
    audienceEmails: [],
    text: "Morning update: drop any files or notes for today's Wi-Fi handoff here so the whole room can stay aligned.",
    files: [],
  },
  {
    senderEmail: "sara@nearboards.local",
    createdAt: "2026-04-16T09:42:00+05:00",
    audienceEmails: ["you@nearboards.local", "maya@nearboards.local"],
    text: "Latest floor plan attached for Maya and this device.",
    files: [
      {
        name: "floor-plan-v3.pdf",
        sizeBytes: 2489000,
        mimeType: "application/pdf",
      },
    ],
  },
  {
    senderEmail: "maya@nearboards.local",
    createdAt: "2026-04-16T10:03:00+05:00",
    audienceEmails: [],
    text: "Fresh signage ideas are ready. If anyone prints samples locally, place the exports here instead of sending them around one by one.",
    files: [],
  },
  {
    senderEmail: "noah@nearboards.local",
    createdAt: "2026-04-16T10:37:00+05:00",
    audienceEmails: ["you@nearboards.local"],
    text: "",
    files: [
      {
        name: "handoff-checklist.xlsx",
        sizeBytes: 896000,
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  },
  {
    senderEmail: "ahmed@nearboards.local",
    createdAt: "2026-04-16T11:08:00+05:00",
    audienceEmails: [],
    text: "",
    files: [
      {
        name: "printer-drivers.zip",
        sizeBytes: 12640000,
        mimeType: "application/zip",
      },
    ],
  },
  {
    senderEmail: "sara@nearboards.local",
    createdAt: "2026-04-16T11:26:00+05:00",
    audienceEmails: ["ali@nearboards.local", "ahmed@nearboards.local"],
    text: "Quiet note for Ali and Ahmed: booth invoice copy is on the board for your review before noon.",
    files: [],
  },
];

const log = (message) => {
  // eslint-disable-next-line no-console
  console.log(`[seed] ${message}`);
};

async function clearExistingData() {
  log("Clearing existing data...");
  const [
    deletedFiles,
    deletedAudiences,
    deletedRecipients,
    deletedShares,
    deletedVerificationTokens,
    deletedPasswordResetTokens,
    deletedSessions,
    deletedUsers,
  ] = await prisma.$transaction([
    prisma.shareFile.deleteMany({}),
    prisma.shareAudience.deleteMany({}),
    prisma.shareRecipient.deleteMany({}),
    prisma.share.deleteMany({}),
    prisma.emailVerificationToken.deleteMany({}),
    prisma.passwordResetToken.deleteMany({}),
    prisma.session.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

  log(`Deleted share files: ${deletedFiles.count}`);
  log(`Deleted share audiences: ${deletedAudiences.count}`);
  log(`Deleted share recipients: ${deletedRecipients.count}`);
  log(`Deleted shares: ${deletedShares.count}`);
  log(`Deleted verification tokens: ${deletedVerificationTokens.count}`);
  log(`Deleted password reset tokens: ${deletedPasswordResetTokens.count}`);
  log(`Deleted sessions: ${deletedSessions.count}`);
  log(`Deleted users: ${deletedUsers.count}`);
}

async function seedUsers() {
  log("Seeding users...");
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);
  const userIdByEmail = new Map();

  for (const user of usersSeed) {
    const createdUser = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    userIdByEmail.set(createdUser.email, createdUser.id);
    log(`Created user #${createdUser.id}: ${createdUser.name} (${createdUser.email})`);
  }

  log(`Users seeded: ${usersSeed.length}`);

  return userIdByEmail;
}

function formatAudienceLabel(audienceEmails) {
  if (!audienceEmails.length) return "everyone";

  const names = usersSeed
    .filter((user) => audienceEmails.includes(user.email))
    .map((user) => user.name);

  return names.join(", ");
}

function resolveUserId(userIdByEmail, email, context) {
  const userId = userIdByEmail.get(email);

  if (!Number.isInteger(userId)) {
    throw new Error(`Unable to resolve user ID for ${context}: ${email}`);
  }

  return userId;
}

async function seedShares(userIdByEmail) {
  log("Seeding shares...");

  for (const share of sharesSeed) {
    const shareDate = new Date(share.createdAt);
    const senderId = resolveUserId(userIdByEmail, share.senderEmail, "sender");

    const audienceRows = share.audienceEmails.map((email) => ({
      actorId: `u:${resolveUserId(userIdByEmail, email, "audience")}`,
      createdAt: shareDate,
    }));

    const createdShare = await prisma.share.create({
      data: {
        senderActorId: `u:${senderId}`,
        senderUserId: senderId,
        text: share.text || null,
        createdAt: shareDate,
        updatedAt: shareDate,
        audiences: {
          create: audienceRows,
        },
        files: {
          create: share.files.map((file, index) => ({
            name: file.name,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            storagePath: `seed/share-${shareDate.getTime()}-${index + 1}-${file.name}`,
            createdAt: shareDate,
            updatedAt: shareDate,
          })),
        },
      },
      select: {
        id: true,
      },
    });

    log(
      `Created share #${createdShare.id} | audience: ${formatAudienceLabel(
        share.audienceEmails
      )} | files: ${share.files.length}`
    );
  }

  log(`Shares seeded: ${sharesSeed.length}`);
}

async function printSummary() {
  const [users, shares, audiences, recipients, files] = await prisma.$transaction([
    prisma.user.count(),
    prisma.share.count(),
    prisma.shareAudience.count(),
    prisma.shareRecipient.count(),
    prisma.shareFile.count(),
  ]);

  log("Seed summary:");
  log(`- users: ${users}`);
  log(`- shares: ${shares}`);
  log(`- audiences: ${audiences}`);
  log(`- recipients: ${recipients}`);
  log(`- files: ${files}`);
  log(`Default seeded password for all users: ${SEED_PASSWORD}`);
}

async function runSeed() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PRODUCTION_SEED !== "true"
  ) {
    throw new Error(
      "Refusing to seed production without ALLOW_PRODUCTION_SEED=true"
    );
  }

  log("Starting Prisma seed...");
  await prisma.$connect();
  log("Database connection established.");

  await clearExistingData();
  const userIdByEmail = await seedUsers();
  await seedShares(userIdByEmail);
  await printSummary();

  log("Seed completed successfully.");
}

runSeed()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[seed] Prisma seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    log("Database connection closed.");
  });

