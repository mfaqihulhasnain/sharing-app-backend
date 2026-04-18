const app = require("./src/app");
const { connectDatabase, disconnectDatabase } = require("./src/config");

let server;

const startServer = async () => {
  await connectDatabase();

  server = app.listen(app.get("port"));
};

const shutdown = async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  await disconnectDatabase();
};

const handleSignal = (signal) => {
  void shutdown()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(`Failed graceful shutdown on ${signal}:`, error);
      process.exit(1);
    });
};

process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));

// Purpose: start the prepared Express app instance.
startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
