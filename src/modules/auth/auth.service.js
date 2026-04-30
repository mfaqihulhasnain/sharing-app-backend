import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import prisma from "../../lib/prisma.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../../lib/mailer.js";
import { env } from "../../config/index.js";
import ApiError from "../../utils/ApiError.js";

const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";
const GOOGLE_PROVIDER = "google";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const EMAIL_VERIFICATION_TOKEN_BYTES = 32;
const PASSWORD_RESET_TOKEN_BYTES = 32;

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerifiedAt: user.emailVerifiedAt,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getRefreshExpiresAt = () =>
  new Date(Date.now() + env.AUTH_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
const getVerificationTokenExpiresAt = () =>
  new Date(Date.now() + env.AUTH_EMAIL_VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000);
const getPasswordResetTokenExpiresAt = () =>
  new Date(Date.now() + env.AUTH_PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

const signAccessToken = ({ userId, sessionId }) =>
  jwt.sign(
    {
      uid: userId,
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
      uid: userId,
      sid: sessionId,
      typ: REFRESH_TOKEN_TYPE,
      jti: crypto.randomUUID(),
    },
    env.AUTH_SECRET,
    {
      expiresIn: `${env.AUTH_REFRESH_TOKEN_TTL_DAYS}d`,
    }
  );

const verifyAccessToken = (accessToken) => {
  try {
    const payload = jwt.verify(accessToken, env.AUTH_SECRET);
    if (
      payload?.typ !== ACCESS_TOKEN_TYPE ||
      !Number.isInteger(payload.uid) ||
      !Number.isInteger(payload.sid)
    ) {
      throw new ApiError(401, "Invalid access token payload");
    }

    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Invalid or expired access token");
  }
};

const verifyRefreshToken = (refreshToken) => {
  try {
    const payload = jwt.verify(refreshToken, env.AUTH_SECRET);
    if (
      payload?.typ !== REFRESH_TOKEN_TYPE ||
      !Number.isInteger(payload.uid) ||
      !Number.isInteger(payload.sid)
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

const rotateSessionTokens = async ({ userId, sessionId, currentRefreshTokenHash }) => {
  const refreshExpiresAt = getRefreshExpiresAt();
  const refreshToken = signRefreshToken({ userId, sessionId });
  const refreshTokenHash = hashToken(refreshToken);

  const updateResult = await prisma.session.updateMany({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
      ...(currentRefreshTokenHash
        ? {
            refreshTokenHash: currentRefreshTokenHash,
          }
        : {}),
    },
    data: {
      refreshTokenHash,
      expiresAt: refreshExpiresAt,
      revokedAt: null,
    },
  });

  if (updateResult.count === 0) {
    throw new ApiError(401, "Refresh token does not match active session");
  }

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

const normalizeEmail = (email) => email.trim().toLowerCase();
const getVerificationLink = (token) => {
  const separator = env.AUTH_EMAIL_VERIFICATION_URL.includes("?") ? "&" : "?";
  return `${env.AUTH_EMAIL_VERIFICATION_URL}${separator}token=${encodeURIComponent(token)}`;
};
const getPasswordResetLink = (token) => {
  const separator = env.AUTH_PASSWORD_RESET_URL.includes("?") ? "&" : "?";
  return `${env.AUTH_PASSWORD_RESET_URL}${separator}token=${encodeURIComponent(token)}`;
};

const ensureGoogleAuthConfig = () => {
  if (
    !env.AUTH_GOOGLE_CLIENT_ID ||
    !env.AUTH_GOOGLE_CLIENT_SECRET ||
    !env.AUTH_GOOGLE_CALLBACK_URL
  ) {
    throw new ApiError(
      500,
      "Google auth is not configured. Set AUTH_GOOGLE_CLIENT_ID, AUTH_GOOGLE_CLIENT_SECRET, and AUTH_GOOGLE_CALLBACK_URL."
    );
  }
};

const createGoogleOAuthClient = () =>
  new OAuth2Client({
    clientId: env.AUTH_GOOGLE_CLIENT_ID,
    clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
    redirectUri: env.AUTH_GOOGLE_CALLBACK_URL,
  });

const getGoogleScopes = () =>
  env.AUTH_GOOGLE_SCOPES.split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

const toBase64Url = (buffer) =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const createPkceVerifier = () => toBase64Url(crypto.randomBytes(48));
const createPkceChallenge = (verifier) =>
  toBase64Url(crypto.createHash("sha256").update(verifier).digest());
const createGoogleOAuthState = () => toBase64Url(crypto.randomBytes(24));

const createGooglePlaceholderPassword = () => `${crypto.randomBytes(40).toString("hex")}Aa1!`;
const createEmailVerificationToken = async ({ userId }) => {
  const token = crypto.randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = getVerificationTokenExpiresAt();
  const now = new Date();

  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
      },
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return {
    token,
    expiresAt,
  };
};

const createPasswordResetToken = async ({ userId }) => {
  const token = crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = getPasswordResetTokenExpiresAt();
  const now = new Date();

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        usedAt: now,
      },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  return {
    token,
    expiresAt,
  };
};

const sendAccountVerificationEmail = async ({ user, token, expiresAt }) => {
  const verificationUrl = getVerificationLink(token);

  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    verificationUrl,
    expiresAt,
  });
};

const sendPasswordResetRequestEmail = async ({ user, token, expiresAt }) => {
  const resetUrl = getPasswordResetLink(token);

  await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    expiresAt,
  });
};

const createDisplayNameFromEmail = (email) => {
  const localPart = email.split("@")[0] || "User";
  const cleaned = localPart.replace(/[^a-zA-Z0-9]+/g, " ").trim();

  if (!cleaned) return "User";

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => `${segment[0].toUpperCase()}${segment.slice(1).toLowerCase()}`)
    .join(" ");
};

// Purpose: contain auth business rules without touching Express req/res objects.
const authService = {
  async startGoogleAuth() {
    ensureGoogleAuthConfig();

    const googleOAuthClient = createGoogleOAuthClient();
    const state = createGoogleOAuthState();
    const pkceVerifier = createPkceVerifier();
    const pkceChallenge = createPkceChallenge(pkceVerifier);

    const authorizationUrl = googleOAuthClient.generateAuthUrl({
      access_type: "offline",
      scope: getGoogleScopes(),
      include_granted_scopes: true,
      prompt: "select_account",
      state,
      code_challenge: pkceChallenge,
      code_challenge_method: "S256",
    });

    return {
      authorizationUrl,
      state,
      pkceVerifier,
    };
  },

  async handleGoogleCallback({ code, state, storedState, pkceVerifier }) {
    ensureGoogleAuthConfig();

    if (!storedState || storedState !== state) {
      throw new ApiError(400, "Invalid Google auth state");
    }

    if (!pkceVerifier) {
      throw new ApiError(400, "Google auth verifier is missing");
    }

    const googleOAuthClient = createGoogleOAuthClient();
    const { tokens: googleTokens } = await googleOAuthClient.getToken({
      code,
      codeVerifier: pkceVerifier,
    });

    const idToken = googleTokens?.id_token;
    if (!idToken) {
      throw new ApiError(401, "Google authentication failed");
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: env.AUTH_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const providerAccountId = payload?.sub;
    const providerEmail = payload?.email;
    const issuer = payload?.iss;
    const emailVerified = payload?.email_verified === true;

    if (
      !providerAccountId ||
      !providerEmail ||
      !emailVerified ||
      !issuer ||
      !GOOGLE_ISSUERS.has(issuer)
    ) {
      throw new ApiError(401, "Google account is not eligible for sign in");
    }

    const normalizedEmail = normalizeEmail(providerEmail);
    const now = new Date();
    const resolvedName =
      typeof payload?.name === "string" && payload.name.trim()
        ? payload.name.trim()
        : createDisplayNameFromEmail(normalizedEmail);

    let user;

    try {
      user = await prisma.$transaction(async (transactionClient) => {
        const existingOAuthAccount = await transactionClient.oAuthAccount.findFirst({
          where: {
            provider: GOOGLE_PROVIDER,
            providerAccountId,
          },
          include: {
            user: true,
          },
        });

        if (existingOAuthAccount) {
          if (!existingOAuthAccount.user?.isActive) {
            throw new ApiError(403, "User is inactive");
          }

          await transactionClient.oAuthAccount.update({
            where: {
              id: existingOAuthAccount.id,
            },
            data: {
              providerEmail: normalizedEmail,
            },
          });

          if (existingOAuthAccount.user.emailVerifiedAt) {
            return existingOAuthAccount.user;
          }

          return transactionClient.user.update({
            where: {
              id: existingOAuthAccount.user.id,
            },
            data: {
              emailVerifiedAt: now,
            },
          });
        }

        const existingUser = await transactionClient.user.findUnique({
          where: {
            email: normalizedEmail,
          },
        });

        if (existingUser) {
          if (!existingUser.isActive) {
            throw new ApiError(403, "User is inactive");
          }

          await transactionClient.oAuthAccount.create({
            data: {
              userId: existingUser.id,
              provider: GOOGLE_PROVIDER,
              providerAccountId,
              providerEmail: normalizedEmail,
            },
          });

          if (existingUser.emailVerifiedAt) {
            return existingUser;
          }

          return transactionClient.user.update({
            where: {
              id: existingUser.id,
            },
            data: {
              emailVerifiedAt: now,
            },
          });
        }

        const passwordHash = await bcrypt.hash(
          createGooglePlaceholderPassword(),
          env.AUTH_BCRYPT_SALT_ROUNDS
        );

        const createdUser = await transactionClient.user.create({
          data: {
            email: normalizedEmail,
            name: resolvedName,
            passwordHash,
            emailVerifiedAt: now,
          },
        });

        await transactionClient.oAuthAccount.create({
          data: {
            userId: createdUser.id,
            provider: GOOGLE_PROVIDER,
            providerAccountId,
            providerEmail: normalizedEmail,
          },
        });

        return createdUser;
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error?.code !== "P2002") {
        throw error;
      }

      const concurrentOAuthAccount = await prisma.oAuthAccount.findFirst({
        where: {
          provider: GOOGLE_PROVIDER,
          providerAccountId,
        },
        include: {
          user: true,
        },
      });

      if (!concurrentOAuthAccount?.user?.isActive) {
        throw new ApiError(403, "User is inactive");
      }

      if (concurrentOAuthAccount.user.emailVerifiedAt) {
        user = concurrentOAuthAccount.user;
      } else {
        user = await prisma.user.update({
          where: {
            id: concurrentOAuthAccount.user.id,
          },
          data: {
            emailVerifiedAt: now,
          },
        });
      }
    }

    const tokens = await issueSessionTokens({
      userId: user.id,
    });

    return {
      user: toPublicUser(user),
      ...tokens,
    };
  },

  async register({ email, password }) {
    const normalizedEmail = normalizeEmail(email);

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ApiError(409, "Email is already in use");
    }

    const passwordHash = await bcrypt.hash(password, env.AUTH_BCRYPT_SALT_ROUNDS);
    const derivedName = createDisplayNameFromEmail(normalizedEmail);

    let user;

    try {
      user = await prisma.user.create({
        data: {
          name: derivedName,
          email: normalizedEmail,
          passwordHash,
          emailVerifiedAt: null,
        },
      });
    } catch (error) {
      if (error?.code === "P2002") {
        throw new ApiError(409, "Email is already in use");
      }
      throw error;
    }

    const { token, expiresAt } = await createEmailVerificationToken({
      userId: user.id,
    });

    let verificationEmailSent = true;

    try {
      await sendAccountVerificationEmail({
        user,
        token,
        expiresAt,
      });
    } catch (error) {
      verificationEmailSent = false;
      // eslint-disable-next-line no-console
      console.error("[auth.register] Failed to send verification email:", error);
    }

    return {
      user: toPublicUser(user),
      verificationEmailSent,
      verificationExpiresAt: expiresAt,
    };
  },

  async login({ email, password }) {
    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user || !user.isActive) {
      throw new ApiError(401, "Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new ApiError(401, "Invalid credentials");
    }

    if (!user.emailVerifiedAt) {
      throw new ApiError(
        403,
        "Email is not verified. Please verify your email before logging in.",
        "EMAIL_NOT_VERIFIED"
      );
    }

    const tokens = await issueSessionTokens({ userId: user.id });

    return {
      user: toPublicUser(user),
      ...tokens,
    };
  },

  async verifyEmail({ token }) {
    const tokenHash = hashToken(token);
    const now = new Date();

    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });

    if (!verificationToken || verificationToken.expiresAt <= now || verificationToken.usedAt) {
      throw new ApiError(400, "Invalid or expired verification token");
    }

    if (!verificationToken.user?.isActive) {
      throw new ApiError(400, "User is inactive");
    }

    const user = await prisma.$transaction(async (transactionClient) => {
      const consumeResult = await transactionClient.emailVerificationToken.updateMany({
        where: {
          id: verificationToken.id,
          usedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
        },
      });

      if (consumeResult.count === 0) {
        throw new ApiError(400, "Invalid or expired verification token");
      }

      await transactionClient.emailVerificationToken.updateMany({
        where: {
          userId: verificationToken.userId,
          id: {
            not: verificationToken.id,
          },
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      return transactionClient.user.update({
        where: {
          id: verificationToken.userId,
        },
        data: {
          emailVerifiedAt: verificationToken.user.emailVerifiedAt || now,
        },
      });
    });

    return {
      user: toPublicUser(user),
    };
  },

  async resendVerification({ email }) {
    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user || !user.isActive || user.emailVerifiedAt) {
      return { accepted: true };
    }

    const latestOpenToken = await prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });

    if (latestOpenToken) {
      const ageSeconds = Math.floor((Date.now() - latestOpenToken.createdAt.getTime()) / 1000);
      const remainingCooldown = env.AUTH_RESEND_VERIFICATION_COOLDOWN_SECONDS - ageSeconds;

      if (remainingCooldown > 0) {
        return { accepted: true };
      }
    }

    try {
      const { token, expiresAt } = await createEmailVerificationToken({
        userId: user.id,
      });

      await sendAccountVerificationEmail({
        user,
        token,
        expiresAt,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[auth.resendVerification] Failed to send verification email:", error);
    }

    return { accepted: true };
  },

  async forgotPassword({ email }) {
    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user || !user.isActive || !user.emailVerifiedAt) {
      return {
        passwordResetEmailSent: false,
        passwordResetExpiresAt: null,
      };
    }

    const latestOpenToken = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });

    if (latestOpenToken) {
      const ageSeconds = Math.floor((Date.now() - latestOpenToken.createdAt.getTime()) / 1000);
      const remainingCooldown = env.AUTH_PASSWORD_RESET_COOLDOWN_SECONDS - ageSeconds;

      if (remainingCooldown > 0) {
        return {
          passwordResetEmailSent: false,
          passwordResetExpiresAt: null,
        };
      }
    }

    const { token, expiresAt } = await createPasswordResetToken({
      userId: user.id,
    });

    let passwordResetEmailSent = true;

    try {
      await sendPasswordResetRequestEmail({
        user,
        token,
        expiresAt,
      });
    } catch (error) {
      passwordResetEmailSent = false;
      // eslint-disable-next-line no-console
      console.error("[auth.forgotPassword] Failed to send password reset email:", error);
    }

    return {
      passwordResetEmailSent,
      passwordResetExpiresAt: expiresAt,
    };
  },

  async resetPassword({ token, password }) {
    const tokenHash = hashToken(token);
    const now = new Date();

    const passwordResetToken = await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });

    if (!passwordResetToken || passwordResetToken.expiresAt <= now || passwordResetToken.usedAt) {
      throw new ApiError(400, "Invalid or expired password reset token");
    }

    if (!passwordResetToken.user?.isActive) {
      throw new ApiError(400, "User is inactive");
    }

    const passwordHash = await bcrypt.hash(password, env.AUTH_BCRYPT_SALT_ROUNDS);

    await prisma.$transaction(async (transactionClient) => {
      const consumeResult = await transactionClient.passwordResetToken.updateMany({
        where: {
          id: passwordResetToken.id,
          usedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
        },
      });

      if (consumeResult.count === 0) {
        throw new ApiError(400, "Invalid or expired password reset token");
      }

      await transactionClient.passwordResetToken.updateMany({
        where: {
          userId: passwordResetToken.userId,
          id: {
            not: passwordResetToken.id,
          },
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await transactionClient.user.update({
        where: {
          id: passwordResetToken.userId,
        },
        data: {
          passwordHash,
        },
      });

      await transactionClient.session.updateMany({
        where: {
          userId: passwordResetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });
    });

    return { passwordReset: true };
  },

  async refreshSession({ refreshToken }) {
    const payload = verifyRefreshToken(refreshToken);

    const session = await prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: payload.uid,
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

    const tokens = await rotateSessionTokens({
      userId: session.userId,
      sessionId: session.id,
      currentRefreshTokenHash: refreshTokenHash,
    });

    return {
      user: toPublicUser(session.user),
      ...tokens,
    };
  },

  async logout({ userId, sessionId, refreshToken, accessToken }) {
    let targetSessionId = sessionId;
    let targetUserId = userId;

    if ((!targetSessionId || !targetUserId) && accessToken) {
      try {
        const payload = verifyAccessToken(accessToken);
        targetSessionId = targetSessionId ?? payload.sid;
        targetUserId = targetUserId ?? payload.uid;
      } catch (_error) {
        // Ignore invalid/expired access tokens for logout and fallback to refresh-token path.
      }
    }

    if (!targetSessionId && refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        targetSessionId = payload.sid;
        targetUserId = targetUserId ?? payload.uid;
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

    if (targetUserId) {
      where.userId = targetUserId;
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
