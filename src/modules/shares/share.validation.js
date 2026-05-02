import { z } from "zod";
import { SHARE_ACTOR_ID_PATTERN } from "./share.model.js";

const emptyToUndefined = (value) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const listShares = z.object({
  query: z.object({
    limit: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(100).default(50)
    ),
    before: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  }),
});

const createShare = z.object({
  body: z
    .object({
      text: z.string().trim().min(1).max(5000),
      audienceActorIds: z
        .array(z.string().trim().regex(SHARE_ACTOR_ID_PATTERN))
        .max(300)
        .default([]),
    })
    .strict(),
});

const deleteShare = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

// Purpose: store share request schemas close to the module boundary.
const shareValidation = {
  listShares,
  createShare,
  deleteShare,
};

export default shareValidation;
