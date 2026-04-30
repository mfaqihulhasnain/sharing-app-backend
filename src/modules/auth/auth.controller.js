import authService from "./auth.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { env } from "../../config/index.js";
import { getCookie } from "../../utils/cookies.js";

const getRefreshCookieOptions = () => {
  const options = {
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: env.AUTH_COOKIE_SAME_SITE,
    path: env.AUTH_REFRESH_COOKIE_PATH,
    maxAge: env.AUTH_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };

  if (env.AUTH_COOKIE_DOMAIN) {
    options.domain = env.AUTH_COOKIE_DOMAIN;
  }

  return options;
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie(env.AUTH_REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
};

const clearRefreshCookie = (res) => {
  const options = getRefreshCookieOptions();
  delete options.maxAge;
  res.clearCookie(env.AUTH_REFRESH_COOKIE_NAME, options);
};

const toAuthResponseData = (result) => ({
  user: result.user,
  accessToken: result.accessToken,
  session: {
    id: result.sessionId,
    refreshExpiresAt: result.refreshExpiresAt,
  },
});

const extractRefreshToken = (req) =>
  req.body?.refreshToken || getCookie(req, env.AUTH_REFRESH_COOKIE_NAME);

const extractAccessToken = (req) => {
  const authorizationHeader = req.headers.authorization;
  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }

  return getCookie(req, "accessToken");
};

const GOOGLE_OAUTH_STATE_COOKIE_NAME = "oauth_google_state";
const GOOGLE_OAUTH_PKCE_COOKIE_NAME = "oauth_google_pkce_verifier";

const getGoogleOAuthCookieOptions = () => {
  const options = {
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: "lax",
    path: env.AUTH_REFRESH_COOKIE_PATH,
    maxAge: env.AUTH_GOOGLE_STATE_TTL_SECONDS * 1000,
  };

  if (env.AUTH_COOKIE_DOMAIN) {
    options.domain = env.AUTH_COOKIE_DOMAIN;
  }

  return options;
};

const setGoogleOAuthCookies = ({ res, state, pkceVerifier }) => {
  const options = getGoogleOAuthCookieOptions();
  res.cookie(GOOGLE_OAUTH_STATE_COOKIE_NAME, state, options);
  res.cookie(GOOGLE_OAUTH_PKCE_COOKIE_NAME, pkceVerifier, options);
};

const clearGoogleOAuthCookies = (res) => {
  const options = getGoogleOAuthCookieOptions();
  delete options.maxAge;
  res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE_NAME, options);
  res.clearCookie(GOOGLE_OAUTH_PKCE_COOKIE_NAME, options);
};

const buildGoogleFailureRedirectUrl = () => {
  const url = new URL(env.AUTH_GOOGLE_FAILURE_REDIRECT_URL);
  url.searchParams.set("reason", "google_auth_failed");
  return url.toString();
};

// Purpose: host auth request handlers and delegate work to the auth service.
const authController = {
  googleStart: asyncHandler(async (_req, res) => {
    const { authorizationUrl, state, pkceVerifier } = await authService.startGoogleAuth();
    setGoogleOAuthCookies({ res, state, pkceVerifier });

    res.redirect(302, authorizationUrl);
  }),

  googleCallback: asyncHandler(async (req, res) => {
    const validatedQuery = req.validatedQuery || req.query;
    const code = validatedQuery.code;
    const state = validatedQuery.state;
    const storedState = getCookie(req, GOOGLE_OAUTH_STATE_COOKIE_NAME);
    const pkceVerifier = getCookie(req, GOOGLE_OAUTH_PKCE_COOKIE_NAME);
    const failureRedirectUrl = buildGoogleFailureRedirectUrl();

    clearGoogleOAuthCookies(res);

    try {
      const result = await authService.handleGoogleCallback({
        code,
        state,
        storedState,
        pkceVerifier,
      });

      setRefreshCookie(res, result.refreshToken);
      res.redirect(302, env.AUTH_GOOGLE_SUCCESS_REDIRECT_URL);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[auth.googleCallback] Google auth failed:", error);
      res.redirect(302, failureRedirectUrl);
    }
  }),

  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(
      new ApiResponse("Account created. Please verify your email to continue.", {
        user: result.user,
        emailVerificationRequired: true,
        verificationEmailSent: result.verificationEmailSent,
        verificationExpiresAt: result.verificationExpiresAt,
      })
    );
  }),

  verifyEmail: asyncHandler(async (req, res) => {
    const result = await authService.verifyEmail(req.body);

    res.status(200).json(
      new ApiResponse("Email verified successfully. You can now log in.", {
        user: result.user,
      })
    );
  }),

  resendVerification: asyncHandler(async (req, res) => {
    await authService.resendVerification(req.body);

    res.status(200).json(
      new ApiResponse("If this email exists and is unverified, a new link has been sent.")
    );
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    await authService.forgotPassword(req.body);

    res
      .status(200)
      .json(new ApiResponse("If an account with that email exists, a reset link has been sent."));
  }),

  resetPassword: asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body);

    clearRefreshCookie(res);

    res
      .status(200)
      .json(new ApiResponse("Password has been reset successfully. Please log in again."));
  }),

  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken);

    res
      .status(200)
      .json(new ApiResponse("Login successful", toAuthResponseData(result)));
  }),

  refreshSession: asyncHandler(async (req, res) => {
    const refreshToken = extractRefreshToken(req);
    const result = await authService.refreshSession({ refreshToken });
    setRefreshCookie(res, result.refreshToken);

    res
      .status(200)
      .json(new ApiResponse("Session refreshed", toAuthResponseData(result)));
  }),

  logout: asyncHandler(async (req, res) => {
    const refreshToken = extractRefreshToken(req);
    const accessToken = extractAccessToken(req);
    await authService.logout({
      userId: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      refreshToken,
      accessToken,
    });

    clearRefreshCookie(res);

    res.status(200).json(new ApiResponse("Logout successful"));
  }),

  logoutAll: asyncHandler(async (req, res) => {
    await authService.logoutAll({
      userId: req.auth.userId,
    });

    clearRefreshCookie(res);

    res.status(200).json(new ApiResponse("Logged out from all sessions"));
  }),

  me: asyncHandler(async (req, res) => {
    const user = await authService.me({
      userId: req.auth.userId,
    });

    res.status(200).json(new ApiResponse("User profile retrieved", { user }));
  }),
};

export default authController;
