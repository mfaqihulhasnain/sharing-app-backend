const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "ChangeMe123!";
const PASSWORD_SALT_ROUNDS = 10;

const BASELINE_USERS = [
  {
    email: "you@sharing-board.local",
    name: "You",
    role: "This device",
    presence: "Ready to share",
    accent: "from-sky-500 to-cyan-400",
  },
  {
    email: "ali@sharing-board.local",
    name: "Ali",
    role: "Product",
    presence: "MacBook Pro",
    accent: "from-amber-400 to-orange-500",
  },
  {
    email: "sara@sharing-board.local",
    name: "Sara",
    role: "Operations",
    presence: "Windows workstation",
    accent: "from-rose-400 to-pink-500",
  },
  {
    email: "maya@sharing-board.local",
    name: "Maya",
    role: "Design",
    presence: "iPad Air",
    accent: "from-violet-400 to-fuchsia-500",
  },
  {
    email: "ahmed@sharing-board.local",
    name: "Ahmed",
    role: "Finance",
    presence: "Android phone",
    accent: "from-emerald-400 to-teal-500",
  },
  {
    email: "noah@sharing-board.local",
    name: "Noah",
    role: "Operations",
    presence: "Chrome on Linux",
    accent: "from-indigo-400 to-blue-500",
  },
];

async function runSeed() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, PASSWORD_SALT_ROUNDS);

  for (const user of BASELINE_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        presence: user.presence,
        accent: user.accent,
        passwordHash,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        presence: user.presence,
        accent: user.accent,
        passwordHash,
      },
    });
  }
}

runSeed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("Prisma seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
