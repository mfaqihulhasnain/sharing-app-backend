import prisma from "../../lib/prisma.js";
import ApiError from "../../utils/ApiError.js";
import {
  SHARE_ACTOR_ID_PATTERN,
  parseAuthenticatedUserIdFromActorId,
  shareSelect,
  toShareDto,
} from "./share.model.js";

const DEFAULT_PAGE_LIMIT = 50;

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

// Purpose: contain share business rules without touching Express req/res objects.
const shareService = {
  async createShare({
    viewer,
    text,
    audienceActorIds,
  }) {
    const normalizedText = typeof text === "string" ? text.trim() : "";
    if (!normalizedText) {
      throw new ApiError(400, "Share text is required");
    }

    const viewerActorId = viewer?.actorId;
    if (!viewerActorId || typeof viewerActorId !== "string") {
      throw new ApiError(400, "Unable to resolve viewer actor");
    }

    const normalizedAudienceActorIds = sanitizeAudienceActorIds({
      audienceActorIds,
      viewerActorId,
    });
    const senderUserId =
      viewer.actorType === "user"
        ? viewer?.user?.id ?? parseAuthenticatedUserIdFromActorId(viewerActorId)
        : null;

    const createdShare = await prisma.share.create({
      data: {
        senderActorId: viewerActorId,
        senderUserId: Number.isInteger(senderUserId) ? senderUserId : null,
        text: normalizedText,
        audiences: normalizedAudienceActorIds.length
          ? {
              create: normalizedAudienceActorIds.map((actorId) => ({
                actorId,
              })),
            }
          : undefined,
      },
      select: shareSelect,
    });

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
    const shares = await prisma.share.findMany({
      where: {
        AND: [
          buildVisibilityWhere({
            viewerActorId,
          }),
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
};

export default shareService;
