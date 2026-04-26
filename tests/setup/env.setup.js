import dotenv from "dotenv";

dotenv.config();

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://test:test@localhost:5432/testdb";

process.env.NODE_ENV = "test";
process.env.PORT = process.env.PORT || "5100";
process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET || "test-auth-secret-at-least-32-characters-long";
process.env.AUTH_ACCESS_TOKEN_TTL = process.env.AUTH_ACCESS_TOKEN_TTL || "15m";
process.env.AUTH_REFRESH_TOKEN_TTL_DAYS = process.env.AUTH_REFRESH_TOKEN_TTL_DAYS || "30";
process.env.AUTH_REFRESH_COOKIE_NAME =
  process.env.AUTH_REFRESH_COOKIE_NAME || "refreshToken";
process.env.AUTH_REFRESH_COOKIE_PATH =
  process.env.AUTH_REFRESH_COOKIE_PATH || "/api/v1/auth";
process.env.AUTH_COOKIE_SAME_SITE = process.env.AUTH_COOKIE_SAME_SITE || "lax";
process.env.AUTH_BCRYPT_SALT_ROUNDS = process.env.AUTH_BCRYPT_SALT_ROUNDS || "10";
process.env.AUTH_COOKIE_SECURE = process.env.AUTH_COOKIE_SECURE || "false";
process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL =
  process.env.TEST_DIRECT_URL || process.env.DIRECT_URL || testDatabaseUrl;
