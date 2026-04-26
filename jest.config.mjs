const sharedConfig = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup/env.setup.js"],
  clearMocks: true,
  restoreMocks: true,
};

const config = {
  projects: [
    {
      ...sharedConfig,
      displayName: "unit",
      testMatch: ["<rootDir>/tests/unit/**/*.test.js"],
    },
    {
      ...sharedConfig,
      displayName: "integration",
      testMatch: ["<rootDir>/tests/integration/**/*.test.js"],
      testTimeout: 60000,
    },
  ],
};

export default config;

