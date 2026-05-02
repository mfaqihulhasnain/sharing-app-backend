import express from "express";
import validate from "../../middleware/validate.js";
import shareController from "./share.controller.js";
import shareValidation from "./share.validation.js";

// Purpose: declare share endpoints and attach share-specific bindings.
const router = express.Router();

router.get("/", validate(shareValidation.listShares), shareController.listShares);
router.post("/", validate(shareValidation.createShare), shareController.createShare);
router.delete("/:id", validate(shareValidation.deleteShare), shareController.deleteShare);

export default router;
