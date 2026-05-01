import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../../lib/prisma.js";
import { env } from "../../config/index.js";
import { parseCookieHeader } from "../../utils/cookies.js";
import {
  toPresenceViewerFromGuest,
  toPresenceViewerFromUser,
} from "./presence.model.js";

const ACCESS_TOKEN_TYPE = "access";
const GUEST_COOKIE_TTL_MS = 1000 * 60 * 60 * 24 * 365;

const normalizeIp = (ip) => {
  if (!ip || typeof ip !== "string") return "unknown";
  const trimmed = ip.trim();
  if (!trimmed) return "unknown";

  if (trimmed === "::1") {
    return "127.0.0.1";
  }

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }

  return trimmed;
};

const buildPresenceTopic = ({ ip }) => {
  const normalizedIp = normalizeIp(ip);
  const digest = crypto
    .createHmac("sha256", env.PRESENCE_HASH_SECRET)
    .update(normalizedIp)
    .digest("hex")
    .slice(0, 40);

  return `${env.PRESENCE_TOPIC_PREFIX}:${digest}`;
};

const resolveAccessToken = ({ authorizationHeader, cookieHeader }) => {
  if (
    typeof authorizationHeader === "string" &&
    authorizationHeader.startsWith("Bearer ")
  ) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }

  const cookies = parseCookieHeader(cookieHeader);
  return cookies.accessToken;
};

const decodeAccessToken = (accessToken) => {
  if (!accessToken) return null;

  try {
    const payload = jwt.verify(accessToken, env.AUTH_SECRET);

    if (
      payload?.typ !== ACCESS_TOKEN_TYPE ||
      !Number.isInteger(payload.uid) ||
      !Number.isInteger(payload.sid)
    ) {
      return null;
    }

    return payload;
  } catch (_error) {
    return null;
  }
};

const resolveAuthenticatedViewerUser = async ({ authorizationHeader, cookieHeader }) => {
  const accessToken = resolveAccessToken({
    authorizationHeader,
    cookieHeader,
  });
  const payload = decodeAccessToken(accessToken);

  if (!payload) {
    return null;
  }

  const session = await prisma.session.findFirst({
    where: {
      id: payload.sid,
      userId: payload.uid,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerifiedAt: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!session?.user?.isActive || !session.user.emailVerifiedAt) {
    return null;
  }

  return session.user;
};

const resolveGuestId = (cookieHeader) => {
  const cookies = parseCookieHeader(cookieHeader);
  const cookieGuestId = cookies[env.PRESENCE_GUEST_COOKIE_NAME];

  if (typeof cookieGuestId === "string" && cookieGuestId.trim()) {
    return {
      guestId: cookieGuestId.trim(),
      shouldSetCookie: false,
    };
  }

  return {
    guestId: crypto.randomUUID(),
    shouldSetCookie: true,
  };
};

const getGuestCookieOptions = () => {
  const options = {
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: env.AUTH_COOKIE_SAME_SITE,
    path: "/",
    maxAge: GUEST_COOKIE_TTL_MS,
  };

  if (env.AUTH_COOKIE_DOMAIN) {
    options.domain = env.AUTH_COOKIE_DOMAIN;
  }

  return options;
};

const presenceService = {
  async getBootstrap({
    ip,
    authorizationHeader,
    cookieHeader,
  }) {
    const topic = buildPresenceTopic({ ip });
    const authUser = await resolveAuthenticatedViewerUser({
      authorizationHeader,
      cookieHeader,
    });

    if (authUser) {
      const viewer = toPresenceViewerFromUser(authUser);

      return {
        topic,
        viewer,
        presence: {
          presenceKeyBase: viewer.actorId,
          guestId: null,
        },
        setGuestCookie: null,
      };
    }

    const { guestId, shouldSetCookie } = resolveGuestId(cookieHeader);
    const viewer = toPresenceViewerFromGuest({ guestId });

    return {
      topic,
      viewer,
      presence: {
        presenceKeyBase: viewer.actorId,
        guestId,
      },
      setGuestCookie: shouldSetCookie
        ? {
            name: env.PRESENCE_GUEST_COOKIE_NAME,
            value: guestId,
            options: getGuestCookieOptions(),
          }
        : null,
    };
  },
};

export default presenceService;
