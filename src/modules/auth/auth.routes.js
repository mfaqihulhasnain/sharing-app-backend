import express from "express";
import authController from "./auth.controller.js";
import authValidation from "./auth.validation.js";
import validate from "../../middleware/validate.js";
import authGuard from "../../middleware/authGuard.js";
import {
  authRegisterRateLimiter,
  authLoginRateLimiter,
  authRefreshRateLimiter,
  authResendVerificationRateLimiter,
  authForgotPasswordRateLimiter,
  authResetPasswordRateLimiter,
  authGoogleStartRateLimiter,
} from "../../middleware/rateLimiter.js";

// Purpose: declare auth endpoints and attach auth-specific bindings.
const router = express.Router();

router.post(
  "/register",
  authRegisterRateLimiter,
  validate(authValidation.register),
  authController.register
);
router.get("/google/start", authGoogleStartRateLimiter, authController.googleStart);
router.get(
  "/google/callback",
  validate(authValidation.googleCallback),
  authController.googleCallback
);
router.post("/verify-email", validate(authValidation.verifyEmail), authController.verifyEmail);
router.post(
  "/resend-verification",
  authResendVerificationRateLimiter,
  validate(authValidation.resendVerification),
  authController.resendVerification
);
router.post(
  "/forgot-password",
  authForgotPasswordRateLimiter,
  validate(authValidation.forgotPassword),
  authController.forgotPassword
);
router.post(
  "/reset-password",
  authResetPasswordRateLimiter,
  validate(authValidation.resetPassword),
  authController.resetPassword
);
router.post("/login", authLoginRateLimiter, validate(authValidation.login), authController.login);
router.post(
  "/refresh",
  authRefreshRateLimiter,
  validate(authValidation.refreshSession),
  authController.refreshSession
);
router.post("/logout", validate(authValidation.logout), authController.logout);
router.post("/logout-all", authGuard, authController.logoutAll);
router.get("/me", authGuard, authController.me);

export default router;
