import rateLimit from "express-rate-limit";

const createLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message,
      });
    },
  });

// Purpose: provide a baseline API-level limit.
const rateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests. Please try again later.",
});

// Purpose: protect registration endpoint from high-volume abuse.
const authRegisterRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many registration attempts. Please try again later.",
});

// Purpose: protect login endpoint from brute-force attempts.
const authLoginRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again later.",
});

// Purpose: protect refresh endpoint from token abuse loops.
const authRefreshRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many session refresh attempts. Please try again later.",
});

// Purpose: protect email verification resend from abuse and enumeration attempts.
const authResendVerificationRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many verification resend attempts. Please try again later.",
});

// Purpose: protect password reset request flow from abuse.
const authForgotPasswordRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password reset requests. Please try again later.",
});

// Purpose: protect password reset consume endpoint from repeated token attempts.
const authResetPasswordRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password reset attempts. Please try again later.",
});

export default rateLimiter;
export {
  authRegisterRateLimiter,
  authLoginRateLimiter,
  authRefreshRateLimiter,
  authResendVerificationRateLimiter,
  authForgotPasswordRateLimiter,
  authResetPasswordRateLimiter,
};
