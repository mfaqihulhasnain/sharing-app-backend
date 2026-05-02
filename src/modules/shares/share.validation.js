import { z } from "zod";
import { SHARE_ACTOR_ID_PATTERN, SHARE_UPLOAD_ID_PATTERN } from "./share.model.js";

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
      text: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
      audienceActorIds: z
        .array(z.string().trim().regex(SHARE_ACTOR_ID_PATTERN))
        .max(300)
        .default([]),
      uploadIds: z
        .array(z.string().trim().regex(SHARE_UPLOAD_ID_PATTERN))
        .max(100)
        .default([]),
    })
    .strict()
    .superRefine((body, context) => {
      const hasText = typeof body.text === "string" && body.text.trim().length > 0;
      const hasUploads = Array.isArray(body.uploadIds) && body.uploadIds.length > 0;

      if (hasText || hasUploads) {
        return;
      }

      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: "Provide text or at least one uploaded file.",
      });
    }),
});

const initUploads = z.object({
  body: z
    .object({
      files: z
        .array(
          z
            .object({
              name: z.string().trim().min(1).max(255),
              mimeType: z.preprocess(
                emptyToUndefined,
                z.string().trim().max(255).optional()
              ),
              sizeBytes: z.coerce.number().int().positive().max(2147483647),
            })
            .strict()
        )
        .min(1)
        .max(100),
    })
    .strict(),
});

const abortUploads = z.object({
  body: z
    .object({
      uploadIds: z
        .array(z.string().trim().regex(SHARE_UPLOAD_ID_PATTERN))
        .min(1)
        .max(300),
    })
    .strict(),
});

const deleteShare = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

const getShareFileDownloadUrl = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
  }),
});

// Purpose: store share request schemas close to the module boundary.
const shareValidation = {
  listShares,
  createShare,
  initUploads,
  abortUploads,
  deleteShare,
  getShareFileDownloadUrl,
};

export default shareValidation;
