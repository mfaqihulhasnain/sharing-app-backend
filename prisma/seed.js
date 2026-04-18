async function runSeed() {
  // Intentionally left blank until real models are defined.
}

runSeed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Prisma seed failed:", error);
  process.exit(1);
});
