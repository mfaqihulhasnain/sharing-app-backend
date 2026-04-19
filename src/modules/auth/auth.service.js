import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import prisma from "../../lib/prisma.js";
import { env } from "../../config/index.js";
import ApiError from "../../utils/ApiError.js";

const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const hashesMatch = (leftHash, rightHash) => {
  if (!leftHash || !rightHash) return false;
  const leftBuffer = Buffer.from(leftHash, "utf8");
  const rightBuffer = Buffer.from(rightHash, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getRefreshExpiresAt = () =>
  new Date(Date.now() + env.AUTH_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

const signAccessToken = ({ userId, sessionId }) =>
  jwt.sign(
    {
      sub: userId,
      sid: sessionId,
      typ: ACCESS_TOKEN_TYPE,
    },
    env.AUTH_SECRET,
    {
      expiresIn: env.AUTH_ACCESS_TOKEN_TTL,
    }
  );

const signRefreshToken = ({ userId, sessionId }) =>
  jwt.sign(
    {
      sub: userId,
      sid: sessionId,
      typ: REFRESH_TOKEN_TYPE,
    },
    env.AUTH_SECRET,
    {
      expiresIn: `${env.AUTH_REFRESH_TOKEN_TTL_DAYS}d`,
    }
  );

const verifyRefreshToken = (refreshToken) => {
  try {
    const payload = jwt.verify(refreshToken, env.AUTH_SECRET);
    if (
      payload?.typ !== REFRESH_TOKEN_TYPE ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string"
    ) {
      throw new ApiError(401, "Invalid refresh token payload");
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Invalid or expired refresh token");
  }
};

const issueSessionTokens = async ({ userId }) =>
  prisma.$transaction(async (transactionClient) => {
    const refreshExpiresAt = getRefreshExpiresAt();
    const session = await transactionClient.session.create({
      data: {
        userId,
        refreshTokenHash: "__pending__",
        expiresAt: refreshExpiresAt,
      },
    });

    const refreshToken = signRefreshToken({
      userId,
      sessionId: session.id,
    });

    const refreshTokenHash = hashToken(refreshToken);
    await transactionClient.session.update({
      where: {
        id: session.id,
      },
      data: {
        refreshTokenHash,
        expiresAt: refreshExpiresAt,
      },
    });

    const accessToken = signAccessToken({
      userId,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
      refreshExpiresAt,
    };
  });

const rotateSessionTokens = async ({ userId, sessionId }) => {
  const refreshExpiresAt = getRefreshExpiresAt();
  const refreshToken = signRefreshToken({ userId, sessionId });
  const refreshTokenHash = hashToken(refreshToken);

  await prisma.session.update({
    where: {
      id: sessionId,
    },
    data: {
      refreshTokenHash,
      expiresAt: refreshExpiresAt,
      revokedAt: null,
    },
  });

  const accessToken = signAccessToken({
    userId,
    sessionId,
  });

  return {
    accessToken,
    refreshToken,
    sessionId,
    refreshExpiresAt,
  };
};

const findActiveUserById = (userId) =>
  prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
    },
  });

const normalizeIdentity = (identifier) => identifier.trim().toLowerCase();

// Purpose: contain auth business rules without touching Express req/res objects.
const authService = {
  async register({ name, username, email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
      },
      select: {
        email: true,
        username: true,
      },
    });

    if (existingUser?.email === normalizedEmail) {
      throw new ApiError(409, "Email is already in use");
    }

    if (existingUser?.username === normalizedUsername) {
      throw new ApiError(409, "Username is already in use");
    }

    const passwordHash = await bcrypt.hash(password, env.AUTH_BCRYPT_SALT_ROUNDS);

    let user;

    try {
      user = await prisma.user.create({
        data: {
          name: name.trim(),
          username: normalizedUsername,
          email: normalizedEmail,
          passwordHash,
        },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        throw new ApiError(409, "Email or username is already in use");
      }
      throw error;
    }

    const tokens = await issueSessionTokens({ userId: user.id });

    return {
      user: toPublicUser(user),
      ...tokens,
    };
  },

  async login({ identifier, password }) {
    const normalizedIdentifier = normalizeIdentity(identifier);

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
      },
    });

    if (!user || !user.isActive) {
      throw new ApiError(401, "Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new ApiError(401, "Invalid credentials");
    }

    const tokens = await issueSessionTokens({ userId: user.id });

    return {
      user: toPublicUser(user),
      ...tokens,
    };
  },

  async refreshSession({ refreshToken }) {
    const payload = verifyRefreshToken(refreshToken);

    const session = await prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
      },
      include: {
        user: true,
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new ApiError(401, "Session has expired or been revoked");
    }

    if (!session.user?.isActive) {
      throw new ApiError(401, "User is inactive");
    }

    const refreshTokenHash = hashToken(refreshToken);
    if (!hashesMatch(session.refreshTokenHash, refreshTokenHash)) {
      throw new ApiError(401, "Refresh token does not match active session");
    }

    const tokens = await rotateSessionTokens({
      userId: session.userId,
      sessionId: session.id,
    });

    return {
      user: toPublicUser(session.user),
      ...tokens,
    };
  },

  async logout({ userId, sessionId, refreshToken }) {
    let targetSessionId = sessionId;

    if (!targetSessionId && refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        targetSessionId = payload.sid;
      } catch (_error) {
        targetSessionId = undefined;
      }
    }

    if (!targetSessionId) {
      return { revoked: false };
    }

    const where = {
      id: targetSessionId,
      revokedAt: null,
    };

    if (userId) {
      where.userId = userId;
    }

    const result = await prisma.session.updateMany({
      where,
      data: {
        revokedAt: new Date(),
      },
    });

    return { revoked: result.count > 0 };
  },

  async logoutAll({ userId }) {
    const result = await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { revokedSessions: result.count };
  },

  async me({ userId }) {
    const user = await findActiveUserById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return toPublicUser(user);
  },
};

export default authService;
