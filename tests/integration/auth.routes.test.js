import request from "supertest";
import app from "../../src/app.js";
import {
  initializeTestDatabase,
  resetDatabase,
  shutdownTestDatabase,
} from "../utils/test-db.js";

const API_BASE = "/api/v1/auth";
const refreshCookieName = process.env.AUTH_REFRESH_COOKIE_NAME || "refreshToken";
let emailCounter = 0;
let agent;

const nextEmail = (prefix = "user") => {
  emailCounter += 1;
  return `${prefix}-${Date.now()}-${emailCounter}@example.com`;
};

const validPassword = "Aa1!abcd";

const extractCookieValue = (setCookieHeaders, cookieName) => {
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [];
  const targetHeader = headers.find((header) => header.startsWith(`${cookieName}=`));
  if (!targetHeader) {
    return "";
  }

  return targetHeader.split(";")[0].split("=")[1] || "";
};

const hasClearedCookie = (setCookieHeaders, cookieName) => {
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [];
  const targetHeader = headers.find((header) => header.startsWith(`${cookieName}=`));
  if (!targetHeader) {
    return false;
  }

  const normalized = targetHeader.toLowerCase();
  return normalized.includes("expires=") || normalized.includes("max-age=0");
};

describe("auth routes integration", () => {
  beforeAll(async () => {
    await initializeTestDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    agent = request.agent(app);
  });

  afterAll(async () => {
    await shutdownTestDatabase();
  });

  test("POST /auth/register succeeds and sets refresh cookie", async () => {
    const response = await agent.post(`${API_BASE}/register`).send({
      email: nextEmail("register-success"),
      password: validPassword,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Account created successfully",
        data: expect.objectContaining({
          accessToken: expect.any(String),
          user: expect.objectContaining({
            email: expect.any(String),
          }),
          session: expect.objectContaining({
            id: expect.any(Number),
            refreshExpiresAt: expect.any(String),
          }),
        }),
      })
    );
    expect(
      response.headers["set-cookie"]?.some((cookie) =>
        cookie.startsWith(`${refreshCookieName}=`)
      )
    ).toBe(true);
  });

  test("POST /auth/register returns 409 for duplicate email", async () => {
    const email = nextEmail("duplicate");
    await request(app).post(`${API_BASE}/register`).send({
      email,
      password: validPassword,
    });

    const duplicate = await request(app).post(`${API_BASE}/register`).send({
      email,
      password: validPassword,
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Email is already in use",
      })
    );
  });

  test("POST /auth/login succeeds and rejects invalid credentials", async () => {
    const email = nextEmail("login");
    await request(app).post(`${API_BASE}/register`).send({
      email,
      password: validPassword,
    });

    const success = await request(app).post(`${API_BASE}/login`).send({
      email,
      password: validPassword,
    });

    expect(success.status).toBe(200);
    expect(success.body.data.accessToken).toEqual(expect.any(String));

    const failure = await request(app).post(`${API_BASE}/login`).send({
      email,
      password: "Aa1!wrong",
    });

    expect(failure.status).toBe(401);
    expect(failure.body).toEqual(
      expect.objectContaining({
        success: false,
        message: "Invalid credentials",
      })
    );
  });

  test("GET /auth/me succeeds with bearer token and fails without token", async () => {
    const email = nextEmail("me");
    const registerResponse = await request(app).post(`${API_BASE}/register`).send({
      email,
      password: validPassword,
    });

    const accessToken = registerResponse.body.data.accessToken;
    const success = await request(app)
      .get(`${API_BASE}/me`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(success.status).toBe(200);
    expect(success.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "User profile retrieved",
      })
    );

    const failure = await request(app).get(`${API_BASE}/me`);
    expect(failure.status).toBe(401);
    expect(failure.body.success).toBe(false);
  });

  test("POST /auth/refresh rotates refresh token and rejects old token reuse", async () => {
    const email = nextEmail("refresh-rotation");
    const registerResponse = await agent.post(`${API_BASE}/register`).send({
      email,
      password: validPassword,
    });
    const originalRefreshToken = extractCookieValue(
      registerResponse.headers["set-cookie"],
      refreshCookieName
    );

    const firstRefresh = await agent.post(`${API_BASE}/refresh`).send({});

    expect(firstRefresh.status).toBe(200);
    expect(firstRefresh.body.data.accessToken).toEqual(expect.any(String));
    const rotatedRefreshToken = extractCookieValue(
      firstRefresh.headers["set-cookie"],
      refreshCookieName
    );
    expect(rotatedRefreshToken).toBeTruthy();
    expect(rotatedRefreshToken).not.toBe(originalRefreshToken);

    const secondRefreshWithRotatedToken = await agent.post(`${API_BASE}/refresh`).send({});
    expect(secondRefreshWithRotatedToken.status).toBe(200);

    const oldTokenReuse = await request(app)
      .post(`${API_BASE}/refresh`)
      .set("Cookie", `${refreshCookieName}=${originalRefreshToken}`)
      .send({});
    expect(oldTokenReuse.status).toBe(401);
  });

  test("POST /auth/logout revokes current session and clears refresh cookie", async () => {
    const email = nextEmail("logout");
    const registerResponse = await agent.post(`${API_BASE}/register`).send({
      email,
      password: validPassword,
    });
    const accessToken = registerResponse.body.data.accessToken;

    const logoutResponse = await agent
      .post(`${API_BASE}/logout`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(logoutResponse.status).toBe(200);
    expect(hasClearedCookie(logoutResponse.headers["set-cookie"], refreshCookieName)).toBe(
      true
    );

    const meAfterLogout = await request(app)
      .get(`${API_BASE}/me`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(meAfterLogout.status).toBe(401);

    const refreshAfterLogout = await agent.post(`${API_BASE}/refresh`).send({});
    expect(refreshAfterLogout.status).toBe(401);
  });

  test("POST /auth/logout-all revokes all sessions for authenticated user", async () => {
    const email = nextEmail("logout-all");
    const registerResponse = await request(app).post(`${API_BASE}/register`).send({
      email,
      password: validPassword,
    });
    const firstAccessToken = registerResponse.body.data.accessToken;

    const secondLogin = await request(app).post(`${API_BASE}/login`).send({
      email,
      password: validPassword,
    });
    const secondAccessToken = secondLogin.body.data.accessToken;

    const logoutAllResponse = await request(app)
      .post(`${API_BASE}/logout-all`)
      .set("Authorization", `Bearer ${firstAccessToken}`)
      .send({});

    expect(logoutAllResponse.status).toBe(200);
    expect(logoutAllResponse.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Logged out from all sessions",
      })
    );

    const firstSessionCheck = await request(app)
      .get(`${API_BASE}/me`)
      .set("Authorization", `Bearer ${firstAccessToken}`);
    expect(firstSessionCheck.status).toBe(401);

    const secondSessionCheck = await request(app)
      .get(`${API_BASE}/me`)
      .set("Authorization", `Bearer ${secondAccessToken}`);
    expect(secondSessionCheck.status).toBe(401);
  });

  test("invalid auth payloads return validation 400 shape", async () => {
    const response = await request(app).post(`${API_BASE}/register`).send({
      email: "invalid-check@example.com",
      password: "Aa1aaaaa",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/^Invalid request:/),
        details: expect.any(Array),
      })
    );
  });
});
