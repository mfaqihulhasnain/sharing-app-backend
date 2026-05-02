import express from "express";
import authGuard from "../../middleware/authGuard.js";
import validate from "../../middleware/validate.js";
import userController from "./user.controller.js";
import userValidation from "./user.validation.js";

// Purpose: declare user endpoints and attach user-specific bindings.
const router = express.Router();

router.get("/", authGuard, validate(userValidation.listUsers), userController.listUsers);
router.get("/me", authGuard, validate(userValidation.getMe), userController.getMe);
router.patch("/me", authGuard, validate(userValidation.updateMe), userController.updateMe);
router.get("/:id", authGuard, validate(userValidation.getUserById), userController.getUserById);

export default router;
