import { toPublicUser, userPublicSelect } from "../users/user.model.js";

const SHARE_ACTOR_ID_PATTERN = /^(u:\d+|g:.+)$/;
const SHARE_UPLOAD_ID_PATTERN = /^[a-zA-Z0-9_-]{10,120}$/;

const shareFileSelect = {
  id: true,
  name: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
};

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
  files: {
    select: shareFileSelect,
    orderBy: {
      createdAt: "asc",
    },
  },
};

const toShareFileDto = (file) => ({
  id: file.id,
  name: file.name,
  mimeType: file.mimeType,
  sizeBytes: file.sizeBytes,
  createdAt: file.createdAt instanceof Date ? file.createdAt.toISOString() : file.createdAt,
});

const toShareDto = (share) => {
  const audienceActorIds = Array.isArray(share?.audiences)
    ? [...new Set(share.audiences.map((audience) => audience.actorId).filter(Boolean))]
    : [];
  const files = Array.isArray(share?.files)
    ? share.files.map(toShareFileDto)
    : [];

  return {
    id: share.id,
    text: typeof share.text === "string" ? share.text : "",
    createdAt: share.createdAt instanceof Date ? share.createdAt.toISOString() : share.createdAt,
    senderActorId: share.senderActorId,
    senderUser: share.senderUser ? toPublicUser(share.senderUser) : null,
    audienceActorIds,
    files,
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
  SHARE_UPLOAD_ID_PATTERN,
  shareFileSelect,
  shareSelect,
  toShareDto,
  parseAuthenticatedUserIdFromActorId,
};

export {
  SHARE_ACTOR_ID_PATTERN,
  SHARE_UPLOAD_ID_PATTERN,
  shareFileSelect,
  shareSelect,
  toShareDto,
  parseAuthenticatedUserIdFromActorId,
};

export default shareModel;
