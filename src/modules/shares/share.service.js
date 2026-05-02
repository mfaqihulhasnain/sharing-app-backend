import crypto from "crypto";
import prisma from "../../lib/prisma.js";
import { env } from "../../config/index.js";
import ApiError from "../../utils/ApiError.js";
import {
  SHARE_ACTOR_ID_PATTERN,
  SHARE_UPLOAD_ID_PATTERN,
  parseAuthenticatedUserIdFromActorId,
  shareSelect,
  toShareDto,
} from "./share.model.js";
import shareStorage from "./share.storage.js";

const DEFAULT_PAGE_LIMIT = 50;
const SHARE_VISIBILITY_WINDOW_MS = 2 * 60 * 60 * 1000;
const DEFAULT_UPLOAD_CONTENT_TYPE = "application/octet-stream";
const DEFAULT_UPLOAD_TOKEN_TTL_SECONDS = 7200;

const sanitizeAudienceActorIds = ({ audienceActorIds = [], viewerActorId }) =>
  [
    ...new Set(
      audienceActorIds
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    ),
  ]
    .filter((actorId) => SHARE_ACTOR_ID_PATTERN.test(actorId))
    .filter((actorId) => actorId !== viewerActorId);

const sanitizeUploadIds = (uploadIds) =>
  [
    ...new Set(
      (Array.isArray(uploadIds) ? uploadIds : [])
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    ),
  ].filter((uploadId) => SHARE_UPLOAD_ID_PATTERN.test(uploadId));

const normalizeShareText = (text) => (typeof text === "string" ? text.trim() : "");

const sanitizeFileName = (value, fallbackName = "file") => {
  const normalized = typeof value === "string" ? value.trim() : "";
  const withoutControlChars = normalized.replace(/[\u0000-\u001f\u007f]/g, "");
  const withoutSlashes = withoutControlChars.replace(/[\\/]/g, "-");
  const collapsed = withoutSlashes.replace(/\s+/g, " ").trim();
  const safeCharsOnly = collapsed.replace(/[^a-zA-Z0-9._()\-[\] ]/g, "");
  const finalName = safeCharsOnly.length > 0 ? safeCharsOnly : fallbackName;

  if (finalName.length <= 120) {
    return finalName;
  }

  return finalName.slice(0, 120).trim() || fallbackName;
};

const toSafePathSegment = (value, fallbackValue) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  const safe = normalized.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  return safe || fallbackValue;
};

const normalizeUploadMimeType = (mimeType) => {
  if (typeof mimeType !== "string") {
    return DEFAULT_UPLOAD_CONTENT_TYPE;
  }

  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_UPLOAD_CONTENT_TYPE;
  }

  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)) {
    return DEFAULT_UPLOAD_CONTENT_TYPE;
  }

  return normalized;
};

const normalizeUploadFiles = (files) =>
  (Array.isArray(files) ? files : []).map((file, index) => {
    const fileSize = Number(file?.sizeBytes);
    if (!Number.isInteger(fileSize) || fileSize <= 0) {
      throw new ApiError(400, `Invalid file size for file #${index + 1}`);
    }

    const sanitizedFileName = sanitizeFileName(file?.name, `file-${index + 1}`);

    return {
      name: sanitizedFileName,
      mimeType: normalizeUploadMimeType(file?.mimeType),
      sizeBytes: fileSize,
    };
  });

const validateUploadLimits = (files) => {
  if (!files.length) {
    throw new ApiError(400, "At least one file is required");
  }

  if (files.length > env.SHARE_UPLOAD_MAX_FILES) {
    throw new ApiError(400, `Maximum ${env.SHARE_UPLOAD_MAX_FILES} files are allowed`);
  }

  const totalSizeBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
  if (totalSizeBytes > env.SHARE_UPLOAD_MAX_TOTAL_SIZE_BYTES) {
    throw new ApiError(
      400,
      `Total file size exceeds ${env.SHARE_UPLOAD_MAX_TOTAL_SIZE_BYTES} bytes`
    );
  }

  files.forEach((file) => {
    if (file.sizeBytes > env.SHARE_UPLOAD_MAX_FILE_SIZE_BYTES) {
      throw new ApiError(
        400,
        `${file.name} exceeds ${env.SHARE_UPLOAD_MAX_FILE_SIZE_BYTES} bytes`
      );
    }
  });
};

const createUploadStoragePath = ({ actorId, fileName }) => {
  const currentDate = new Date();
  const year = String(currentDate.getUTCFullYear());
  const month = String(currentDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getUTCDate()).padStart(2, "0");
  const actorSegment = toSafePathSegment(actorId, "viewer");
  const uniquePart =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex");
  const sanitizedName = sanitizeFileName(fileName, "file");

  return `shares/${year}/${month}/${day}/${actorSegment}/${uniquePart}-${sanitizedName}`;
};

const encodeCursor = (share) =>
  Buffer.from(
    JSON.stringify({
      createdAt:
        share.createdAt instanceof Date
          ? share.createdAt.toISOString()
          : String(share.createdAt),
      id: share.id,
    }),
    "utf8"
  ).toString("base64url");

const decodeCursor = (cursor) => {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isInteger(parsed.id) || !parsed.createdAt) {
      return null;
    }

    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return {
      id: parsed.id,
      createdAt,
    };
  } catch (_error) {
    return null;
  }
};

const toPaginationWhere = (before) => {
  if (!before) {
    return undefined;
  }

  const cursor = decodeCursor(before);
  if (!cursor) {
    throw new ApiError(400, "Invalid before cursor");
  }

  return {
    OR: [
      {
        createdAt: {
          lt: cursor.createdAt,
        },
      },
      {
        createdAt: cursor.createdAt,
        id: {
          lt: cursor.id,
        },
      },
    ],
  };
};

const buildVisibilityWhere = ({ viewerActorId }) => ({
  OR: [
    {
      senderActorId: viewerActorId,
    },
    {
      audiences: {
        some: {
          actorId: viewerActorId,
        },
      },
    },
    {
      audiences: {
        none: {},
      },
    },
  ],
});

const getShareVisibilityWindowStart = () =>
  new Date(Date.now() - SHARE_VISIBILITY_WINDOW_MS);

const isViewerAllowedForShare = ({
  share,
  viewerActorId,
}) => {
  if (!share || typeof viewerActorId !== "string" || !viewerActorId.trim()) {
    return false;
  }

  if (share.senderActorId === viewerActorId) {
    return true;
  }

  const audienceActorIds = Array.isArray(share.audiences)
    ? share.audiences
        .map((audience) => (typeof audience?.actorId === "string" ? audience.actorId.trim() : ""))
        .filter(Boolean)
    : [];
  if (!audienceActorIds.length) {
    return true;
  }

  return audienceActorIds.includes(viewerActorId);
};

// Purpose: contain share business rules without touching Express req/res objects.
const shareService = {
  async initUploads({
    viewerActorId,
    files,
  }) {
    if (!viewerActorId || typeof viewerActorId !== "string") {
      throw new ApiError(400, "Unable to resolve viewer actor");
    }

    const normalizedFiles = normalizeUploadFiles(files);
    validateUploadLimits(normalizedFiles);

    const preparedUploads = [];
    for (const file of normalizedFiles) {
      const uploadId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : crypto.randomBytes(16).toString("hex");
      const storagePath = createUploadStoragePath({
        actorId: viewerActorId,
        fileName: file.name,
      });
      const signedTarget = await shareStorage.createSignedUploadTarget({
        storagePath,
      });
      const expiresInSeconds =
        Number.isInteger(signedTarget.expiresInSeconds) && signedTarget.expiresInSeconds > 0
          ? signedTarget.expiresInSeconds
          : DEFAULT_UPLOAD_TOKEN_TTL_SECONDS;
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      preparedUploads.push({
        id: uploadId,
        actorId: viewerActorId,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        bucket: shareStorage.getBucketName(),
        storagePath: signedTarget.path || storagePath,
        uploadToken: signedTarget.token,
        expiresAt,
      });
    }

    await prisma.shareUpload.createMany({
      data: preparedUploads.map((upload) => ({
        id: upload.id,
        actorId: upload.actorId,
        name: upload.name,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
        bucket: upload.bucket,
        storagePath: upload.storagePath,
        uploadToken: upload.uploadToken,
        expiresAt: upload.expiresAt,
      })),
    });

    return {
      uploads: preparedUploads.map((upload) => ({
        uploadId: upload.id,
        path: upload.storagePath,
        token: upload.uploadToken,
        bucket: upload.bucket,
        expiresAt: upload.expiresAt.toISOString(),
      })),
    };
  },

  async abortUploads({
    viewerActorId,
    uploadIds,
  }) {
    if (!viewerActorId || typeof viewerActorId !== "string") {
      throw new ApiError(400, "Unable to resolve viewer actor");
    }

    const normalizedUploadIds = sanitizeUploadIds(uploadIds);
    if (!normalizedUploadIds.length) {
      return {
        abortedUploadIds: [],
      };
    }

    const matchingUploads = await prisma.shareUpload.findMany({
      where: {
        id: {
          in: normalizedUploadIds,
        },
        actorId: viewerActorId,
        consumedAt: null,
      },
      select: {
        id: true,
        storagePath: true,
      },
    });
    if (!matchingUploads.length) {
      return {
        abortedUploadIds: [],
      };
    }

    try {
      await shareStorage.removeFiles({
        storagePaths: matchingUploads.map((upload) => upload.storagePath),
      });
    } catch (_error) {
      // Ignore cleanup failures and continue revoking staged upload records.
    }

    const matchingUploadIds = matchingUploads.map((upload) => upload.id);
    await prisma.shareUpload.deleteMany({
      where: {
        id: {
          in: matchingUploadIds,
        },
        actorId: viewerActorId,
        consumedAt: null,
      },
    });

    return {
      abortedUploadIds: matchingUploadIds,
    };
  },

  async createShare({
    viewer,
    text,
    audienceActorIds,
    uploadIds,
  }) {
    const normalizedText = normalizeShareText(text);
    const viewerActorId = viewer?.actorId;
    if (!viewerActorId || typeof viewerActorId !== "string") {
      throw new ApiError(400, "Unable to resolve viewer actor");
    }

    const normalizedUploadIds = sanitizeUploadIds(uploadIds);
    if (!normalizedText && !normalizedUploadIds.length) {
      throw new ApiError(400, "Share text or uploaded files are required");
    }

    const normalizedAudienceActorIds = sanitizeAudienceActorIds({
      audienceActorIds,
      viewerActorId,
    });
    const senderUserId =
      viewer.actorType === "user"
        ? viewer?.user?.id ?? parseAuthenticatedUserIdFromActorId(viewerActorId)
        : null;
    const now = new Date();

    const createdShare = await prisma.$transaction(async (tx) => {
      const stagedUploads = normalizedUploadIds.length
        ? await tx.shareUpload.findMany({
            where: {
              id: {
                in: normalizedUploadIds,
              },
              actorId: viewerActorId,
              consumedAt: null,
              expiresAt: {
                gt: now,
              },
            },
            select: {
              id: true,
              actorId: true,
              name: true,
              mimeType: true,
              sizeBytes: true,
              bucket: true,
              storagePath: true,
            },
          })
        : [];

      if (stagedUploads.length !== normalizedUploadIds.length) {
        throw new ApiError(400, "One or more uploads are invalid or expired");
      }

      const shareRecord = await tx.share.create({
        data: {
          senderActorId: viewerActorId,
          senderUserId: Number.isInteger(senderUserId) ? senderUserId : null,
          text: normalizedText || null,
          audiences: normalizedAudienceActorIds.length
            ? {
                create: normalizedAudienceActorIds.map((actorId) => ({
                  actorId,
                })),
              }
            : undefined,
        },
        select: {
          id: true,
        },
      });

      if (stagedUploads.length) {
        const consumeUploadsResult = await tx.shareUpload.updateMany({
          where: {
            id: {
              in: stagedUploads.map((upload) => upload.id),
            },
            actorId: viewerActorId,
            consumedAt: null,
            expiresAt: {
              gt: now,
            },
          },
          data: {
            consumedAt: now,
            shareId: shareRecord.id,
          },
        });

        if (consumeUploadsResult.count !== stagedUploads.length) {
          throw new ApiError(409, "Upload commit conflict. Please try sharing again.");
        }

        await tx.shareFile.createMany({
          data: stagedUploads.map((upload) => ({
            shareId: shareRecord.id,
            name: upload.name,
            mimeType: upload.mimeType,
            sizeBytes: upload.sizeBytes,
            storagePath: upload.storagePath,
          })),
        });
      }

      return tx.share.findUnique({
        where: {
          id: shareRecord.id,
        },
        select: shareSelect,
      });
    });

    if (!createdShare) {
      throw new ApiError(500, "Unable to create share");
    }

    return toShareDto(createdShare);
  },

  async listShares({
    viewerActorId,
    limit = DEFAULT_PAGE_LIMIT,
    before,
  }) {
    if (!viewerActorId || typeof viewerActorId !== "string") {
      throw new ApiError(400, "Unable to resolve viewer actor");
    }

    const paginationWhere = toPaginationWhere(before);
    const visibilityWindowStart = getShareVisibilityWindowStart();
    const shares = await prisma.share.findMany({
      where: {
        AND: [
          buildVisibilityWhere({
            viewerActorId,
          }),
          {
            deletedAt: null,
          },
          {
            createdAt: {
              gte: visibilityWindowStart,
            },
          },
          ...(paginationWhere ? [paginationWhere] : []),
        ],
      },
      select: shareSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = shares.length > limit;
    const visibleShares = hasMore ? shares.slice(0, limit) : shares;
    const nextCursor = hasMore ? encodeCursor(visibleShares[visibleShares.length - 1]) : null;

    return {
      shares: visibleShares.map(toShareDto),
      page: {
        limit,
        nextCursor,
        hasMore,
      },
    };
  },

  async getShareFileDownloadUrl({
    id,
    viewerActorId,
  }) {
    if (!viewerActorId || typeof viewerActorId !== "string") {
      throw new ApiError(400, "Unable to resolve viewer actor");
    }

    const shareFile = await prisma.shareFile.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        storagePath: true,
        share: {
          select: {
            id: true,
            senderActorId: true,
            deletedAt: true,
            audiences: {
              select: {
                actorId: true,
              },
            },
          },
        },
      },
    });
    if (!shareFile?.share || shareFile.share.deletedAt) {
      throw new ApiError(404, "File not found");
    }

    if (
      !isViewerAllowedForShare({
        share: shareFile.share,
        viewerActorId,
      })
    ) {
      throw new ApiError(403, "You are not allowed to access this file");
    }

    const signedDownload = await shareStorage.createSignedDownloadUrl({
      storagePath: shareFile.storagePath,
      downloadFileName: shareFile.name,
    });

    return {
      url: signedDownload.url,
      expiresAt: new Date(
        Date.now() + signedDownload.expiresInSeconds * 1000
      ).toISOString(),
    };
  },

  async deleteShare({
    id,
    viewerActorId,
  }) {
    if (!viewerActorId || typeof viewerActorId !== "string") {
      throw new ApiError(400, "Unable to resolve viewer actor");
    }

    const existingShare = await prisma.share.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        senderActorId: true,
        deletedAt: true,
      },
    });

    if (!existingShare || existingShare.deletedAt) {
      throw new ApiError(404, "Share not found");
    }

    if (existingShare.senderActorId !== viewerActorId) {
      throw new ApiError(403, "You can delete only your own shares");
    }

    await prisma.share.update({
      where: {
        id: existingShare.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      id: existingShare.id,
    };
  },
};

export default shareService;
