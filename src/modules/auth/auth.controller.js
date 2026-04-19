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

// Purpose: host auth request handlers and delegate work to the auth service.
const authController = {
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    setRefreshCookie(res, result.refreshToken);

    res
      .status(201)
      .json(new ApiResponse("Account created successfully", toAuthResponseData(result)));
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
    await authService.logout({
      userId: req.auth?.userId,
      sessionId: req.auth?.sessionId,
      refreshToken,
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
