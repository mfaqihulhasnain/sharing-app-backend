import { z } from "zod";

const emptyToUndefined = (value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }

  return value;
};

const listUsers = z.object({
  query: z.object({
    q: z.preprocess(emptyToUndefined, z.string().trim().max(120).default("")),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
    limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).default(20)),
    includeMe: z.preprocess(
      (value) => parseBoolean(emptyToUndefined(value)),
      z.boolean().default(false)
    ),
  }),
});

const getMe = z.object({});

const updateMe = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80),
    })
    .strict(),
});

const getUserById = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

// Purpose: store user request schemas close to the module boundary.
const userValidation = {
  listUsers,
  getMe,
  updateMe,
  getUserById,
};

export default userValidation;
