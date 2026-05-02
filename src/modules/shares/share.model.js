import { toPublicUser, userPublicSelect } from "../users/user.model.js";

const SHARE_ACTOR_ID_PATTERN = /^(u:\d+|g:.+)$/;

const shareSelect = {
  id: true,
  text: true,
  createdAt: true,
  senderActorId: true,
  senderUser: {
    select: userPublicSelect,
  },
  audiences: {
    select: {
      actorId: true,
    },
    orderBy: {
      actorId: "asc",
    },
  },
};

const toShareDto = (share) => {
  const audienceActorIds = Array.isArray(share?.audiences)
    ? [...new Set(share.audiences.map((audience) => audience.actorId).filter(Boolean))]
    : [];

  return {
    id: share.id,
    text: typeof share.text === "string" ? share.text : "",
    createdAt: share.createdAt instanceof Date ? share.createdAt.toISOString() : share.createdAt,
    senderActorId: share.senderActorId,
    senderUser: share.senderUser ? toPublicUser(share.senderUser) : null,
    audienceActorIds,
    files: [],
  };
};

const parseAuthenticatedUserIdFromActorId = (actorId) => {
  if (typeof actorId !== "string") return null;
  const match = /^u:(\d+)$/.exec(actorId.trim());
  if (!match) return null;

  return Number(match[1]);
};

const shareModel = {
  SHARE_ACTOR_ID_PATTERN,
  shareSelect,
  toShareDto,
  parseAuthenticatedUserIdFromActorId,
};

export {
  SHARE_ACTOR_ID_PATTERN,
  shareSelect,
  toShareDto,
  parseAuthenticatedUserIdFromActorId,
};

export default shareModel;
