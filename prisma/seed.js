import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_PASSWORD = "Password@123";
const SALT_ROUNDS = 10;

const usersSeed = [
  {
    id: "usr_you",
    name: "You",
    username: "you",
    email: "you@sharing.local",
  },
  {
    id: "usr_ali",
    name: "Ali",
    username: "ali",
    email: "ali@sharing.local",
  },
  {
    id: "usr_sara",
    name: "Sara",
    username: "sara",
    email: "sara@sharing.local",
  },
  {
    id: "usr_maya",
    name: "Maya",
    username: "maya",
    email: "maya@sharing.local",
  },
  {
    id: "usr_ahmed",
    name: "Ahmed",
    username: "ahmed",
    email: "ahmed@sharing.local",
  },
  {
    id: "usr_noah",
    name: "Noah",
    username: "noah",
    email: "noah@sharing.local",
  },
];

const sharesSeed = [
  {
    id: "shr_1",
    senderId: "usr_ali",
    createdAt: "2026-04-16T09:14:00+05:00",
    audienceIds: [],
    text: "Morning update: drop any files or notes for today's Wi-Fi handoff here so the whole room can stay aligned.",
    files: [],
  },
  {
    id: "shr_2",
    senderId: "usr_sara",
    createdAt: "2026-04-16T09:42:00+05:00",
    audienceIds: ["usr_you", "usr_maya"],
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
    id: "shr_3",
    senderId: "usr_maya",
    createdAt: "2026-04-16T10:03:00+05:00",
    audienceIds: [],
    text: "Fresh signage ideas are ready. If anyone prints samples locally, place the exports here instead of sending them around one by one.",
    files: [],
  },
  {
    id: "shr_4",
    senderId: "usr_noah",
    createdAt: "2026-04-16T10:37:00+05:00",
    audienceIds: ["usr_you"],
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
    id: "shr_5",
    senderId: "usr_ahmed",
    createdAt: "2026-04-16T11:08:00+05:00",
    audienceIds: [],
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
    id: "shr_6",
    senderId: "usr_sara",
    createdAt: "2026-04-16T11:26:00+05:00",
    audienceIds: ["usr_ali", "usr_ahmed"],
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
  const [deletedFiles, deletedRecipients, deletedShares, deletedSessions, deletedUsers] =
    await prisma.$transaction([
      prisma.shareFile.deleteMany({}),
      prisma.shareRecipient.deleteMany({}),
      prisma.share.deleteMany({}),
      prisma.session.deleteMany({}),
      prisma.user.deleteMany({}),
    ]);

  log(`Deleted share files: ${deletedFiles.count}`);
  log(`Deleted share recipients: ${deletedRecipients.count}`);
  log(`Deleted shares: ${deletedShares.count}`);
  log(`Deleted sessions: ${deletedSessions.count}`);
  log(`Deleted users: ${deletedUsers.count}`);
}

async function seedUsers() {
  log("Seeding users...");
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  for (const user of usersSeed) {
    await prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        passwordHash,
      },
    });

    log(`Created user: ${user.name} (${user.username})`);
  }

  log(`Users seeded: ${usersSeed.length}`);
}

function formatAudienceLabel(audienceIds) {
  if (!audienceIds.length) return "everyone";

  const names = usersSeed
    .filter((user) => audienceIds.includes(user.id))
    .map((user) => user.name);

  return names.join(", ");
}

async function seedShares() {
  log("Seeding shares...");

  for (const share of sharesSeed) {
    const shareDate = new Date(share.createdAt);

    await prisma.share.create({
      data: {
        id: share.id,
        senderId: share.senderId,
        text: share.text || null,
        createdAt: shareDate,
        updatedAt: shareDate,
        recipients: {
          create: share.audienceIds.map((userId) => ({
            userId,
            createdAt: shareDate,
          })),
        },
        files: {
          create: share.files.map((file, index) => ({
            id: `fil_${share.id}_${index + 1}`,
            name: file.name,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            storagePath: `seed/${share.id}/${file.name}`,
            createdAt: shareDate,
            updatedAt: shareDate,
          })),
        },
      },
    });

    log(
      `Created share: ${share.id} | audience: ${formatAudienceLabel(
        share.audienceIds
      )} | files: ${share.files.length}`
    );
  }

  log(`Shares seeded: ${sharesSeed.length}`);
}

async function printSummary() {
  const [users, shares, recipients, files] = await prisma.$transaction([
    prisma.user.count(),
    prisma.share.count(),
    prisma.shareRecipient.count(),
    prisma.shareFile.count(),
  ]);

  log("Seed summary:");
  log(`- users: ${users}`);
  log(`- shares: ${shares}`);
  log(`- recipients: ${recipients}`);
  log(`- files: ${files}`);
  log(
    `Default seeded password for all users: ${SEED_PASSWORD}`
  );
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
  await seedUsers();
  await seedShares();
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
