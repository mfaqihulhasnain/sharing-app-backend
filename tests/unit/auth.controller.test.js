import { jest } from "@jest/globals";
import authController from "../../src/modules/auth/auth.controller.js";
import authService from "../../src/modules/auth/auth.service.js";

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const createMockResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  response.cookie = jest.fn().mockReturnValue(response);
  response.clearCookie = jest.fn().mockReturnValue(response);
  return response;
};

const invokeHandler = async (handler, req, res, next) => {
  handler(req, res, next);
  await flushPromises();
};

const authResult = {
  user: {
    id: 11,
    email: "person@example.com",
    name: "Person",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  accessToken: "access-token-value",
  refreshToken: "refresh-token-value",
  sessionId: 44,
  refreshExpiresAt: new Date(Date.now() + 3600000),
};

describe("auth.controller", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("refreshSession uses refresh token from request body and returns success response", async () => {
    const req = {
      body: { refreshToken: "refresh-token-from-body" },
      headers: {},
    };
    const res = createMockResponse();
    const next = jest.fn();

    const refreshSpy = jest
      .spyOn(authService, "refreshSession")
      .mockResolvedValue(authResult);

    await invokeHandler(authController.refreshSession, req, res, next);

    expect(refreshSpy).toHaveBeenCalledWith({
      refreshToken: "refresh-token-from-body",
    });
    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Session refreshed",
        data: expect.objectContaining({
          accessToken: authResult.accessToken,
          session: expect.objectContaining({
            id: authResult.sessionId,
          }),
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("refreshSession falls back to refresh token cookie when body token is missing", async () => {
    const cookieName = process.env.AUTH_REFRESH_COOKIE_NAME || "refreshToken";
    const req = {
      body: {},
      headers: {
        cookie: `${cookieName}=refresh-token-from-cookie`,
      },
    };
    const res = createMockResponse();
    const next = jest.fn();

    const refreshSpy = jest
      .spyOn(authService, "refreshSession")
      .mockResolvedValue(authResult);

    await invokeHandler(authController.refreshSession, req, res, next);

    expect(refreshSpy).toHaveBeenCalledWith({
      refreshToken: "refresh-token-from-cookie",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("logout forwards both access and refresh tokens to service", async () => {
    const cookieName = process.env.AUTH_REFRESH_COOKIE_NAME || "refreshToken";
    const req = {
      body: {},
      headers: {
        authorization: "Bearer access-token-from-header",
        cookie: `${cookieName}=refresh-token-from-cookie`,
      },
    };
    const res = createMockResponse();
    const next = jest.fn();

    const logoutSpy = jest.spyOn(authService, "logout").mockResolvedValue({ revoked: true });

    await invokeHandler(authController.logout, req, res, next);

    expect(logoutSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: undefined,
        sessionId: undefined,
        accessToken: "access-token-from-header",
        refreshToken: "refresh-token-from-cookie",
      })
    );
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test("login returns expected success status and shape", async () => {
    const req = {
      body: {
        email: "person@example.com",
        password: "Aa1!abcd",
      },
      headers: {},
    };
    const res = createMockResponse();
    const next = jest.fn();

    jest.spyOn(authService, "login").mockResolvedValue(authResult);

    await invokeHandler(authController.login, req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Login successful",
        data: expect.objectContaining({
          user: expect.objectContaining({
            email: authResult.user.email,
          }),
          accessToken: authResult.accessToken,
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("async handler forwards service errors to next()", async () => {
    const req = {
      body: { refreshToken: "broken-refresh-token" },
      headers: {},
    };
    const res = createMockResponse();
    const next = jest.fn();
    const failure = new Error("refresh failed");

    jest.spyOn(authService, "refreshSession").mockRejectedValue(failure);

    await invokeHandler(authController.refreshSession, req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
  });
});

