import express from "express";
import ApiResponse from "../utils/ApiResponse.js";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/users/user.routes.js";
import presenceRoutes from "../modules/presence/presence.routes.js";
import shareRoutes from "../modules/shares/share.routes.js";

// Purpose: register versioned API routes in one central place.
const router = express.Router();

router.get("/health", (_req, res) => {
  res.status(200).json(new ApiResponse("Backend connected successfully"));
});
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/presence", presenceRoutes);
router.use("/shares", shareRoutes);

export default router;
