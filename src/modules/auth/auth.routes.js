import express from "express";
import authController from "./auth.controller.js";
import authValidation from "./auth.validation.js";
import validate from "../../middleware/validate.js";
import authGuard from "../../middleware/authGuard.js";

// Purpose: declare auth endpoints and attach auth-specific bindings.
const router = express.Router();

router.post("/register", validate(authValidation.register), authController.register);
router.post("/login", validate(authValidation.login), authController.login);
router.post("/refresh", validate(authValidation.refreshSession), authController.refreshSession);
router.post("/logout", validate(authValidation.logout), authController.logout);
router.post("/logout-all", authGuard, authController.logoutAll);
router.get("/me", authGuard, authController.me);

export default router;
