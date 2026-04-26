import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const emptyToUndefined = (value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const booleanFromString = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  return value;
};

const getPrimaryOrigin = (value) => {
  if (!value) return undefined;

  return value
    .split(",")
    .map((origin) => origin.trim())
    .find(Boolean);
};

// Purpose: validate and centralize runtime environment values.
const envSchema = z.object({
  NODE_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(["development", "test", "production"]).default("development")
  ),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(5000)),
  CLIENT_ORIGIN: z.preprocess(emptyToUndefined, z.string().optional()),
  DATABASE_URL: z.preprocess(
    emptyToUndefined,
    z.string().min(1, "DATABASE_URL is required")
  ),
  DIRECT_URL: z.preprocess(emptyToUndefined, z.string().optional()),
  AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
  AUTH_ACCESS_TOKEN_TTL: z.preprocess(emptyToUndefined, z.string().default("15m")),
  AUTH_REFRESH_TOKEN_TTL_DAYS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().max(365).default(30)
  ),
  AUTH_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().max(1440).default(30)
  ),
  AUTH_RESEND_VERIFICATION_COOLDOWN_SECONDS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().max(3600).default(60)
  ),
  AUTH_EMAIL_VERIFICATION_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  AUTH_REFRESH_COOKIE_NAME: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("refreshToken")
  ),
  AUTH_REFRESH_COOKIE_PATH: z.preprocess(
    emptyToUndefined,
    z.string().min(1).default("/api/v1/auth")
  ),
  AUTH_COOKIE_SAME_SITE: z.preprocess(
    emptyToUndefined,
    z.enum(["lax", "strict", "none"]).default("lax")
  ),
  AUTH_COOKIE_SECURE: z.preprocess(
    (value) => booleanFromString(emptyToUndefined(value)),
    z.boolean().optional()
  ),
  AUTH_COOKIE_DOMAIN: z.preprocess(emptyToUndefined, z.string().optional()),
  AUTH_BCRYPT_SALT_ROUNDS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(8).max(15).default(10)
  ),
  MAIL_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  MAIL_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(2525)),
  MAIL_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  MAIL_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  MAIL_FROM: z.preprocess(emptyToUndefined, z.string().optional()),
  MAIL_SECURE: z.preprocess(
    (value) => booleanFromString(emptyToUndefined(value)),
    z.boolean().optional()
  ),
});

const parsedEnv = envSchema.parse(process.env);
const defaultDevAuthSecret = "dev-only-auth-secret-change-before-production-12345";
const authSecret =
  parsedEnv.AUTH_SECRET ||
  (parsedEnv.NODE_ENV === "production" ? undefined : defaultDevAuthSecret);
const primaryClientOrigin = getPrimaryOrigin(parsedEnv.CLIENT_ORIGIN);
const defaultEmailVerificationUrl = `${primaryClientOrigin || "http://localhost:3000"}/verify-email`;

if (!authSecret) {
  throw new Error("AUTH_SECRET is required in production");
}

const env = {
  ...parsedEnv,
  AUTH_SECRET: authSecret,
  AUTH_EMAIL_VERIFICATION_URL:
    parsedEnv.AUTH_EMAIL_VERIFICATION_URL || defaultEmailVerificationUrl,
  AUTH_COOKIE_SECURE:
    parsedEnv.AUTH_COOKIE_SECURE ?? parsedEnv.NODE_ENV === "production",
  MAIL_SECURE: parsedEnv.MAIL_SECURE ?? false,
};

export { env };
