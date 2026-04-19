import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { env } from "../config/index.js";
import ApiError from "../utils/ApiError.js";
import { getCookie } from "../utils/cookies.js";

const resolveAccessToken = (req) => {
  const authorizationHeader = req.headers.authorization;
  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }

  return getCookie(req, "accessToken");
};

// Purpose: protect private routes via signed access tokens and active sessions.
const authGuard = async (req, _res, next) => {
  try {
    const accessToken = resolveAccessToken(req);

    if (!accessToken) {
      throw new ApiError(401, "Authentication required");
    }

    let payload;

    try {
      payload = jwt.verify(accessToken, env.AUTH_SECRET);
    } catch (_error) {
      throw new ApiError(401, "Invalid or expired access token");
    }

    if (
      payload?.typ !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string"
    ) {
      throw new ApiError(401, "Invalid access token payload");
    }

    const session = await prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || !session.user?.isActive) {
      throw new ApiError(401, "Session is no longer valid");
    }

    req.auth = {
      userId: session.user.id,
      sessionId: session.id,
    };

    req.user = session.user;

    next();
  } catch (error) {
    next(error);
  }
};

export default authGuard;
