const dotenv = require("dotenv");
const { z } = require("zod");

dotenv.config();

const emptyToUndefined = (value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
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
  AUTH_STRATEGY: z.preprocess(emptyToUndefined, z.string().optional()),
  AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
});

const env = envSchema.parse(process.env);

module.exports = { env };
