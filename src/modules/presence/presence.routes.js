import express from "express";
import validate from "../../middleware/validate.js";
import presenceController from "./presence.controller.js";
import presenceValidation from "./presence.validation.js";

const router = express.Router();

router.get(
  "/bootstrap",
  validate(presenceValidation.bootstrap),
  presenceController.bootstrap
);

export default router;
