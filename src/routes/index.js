const express = require("express");
const ApiResponse = require("../utils/ApiResponse");
const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/users/user.routes");
const shareRoutes = require("../modules/shares/share.routes");

// Purpose: register versioned API routes in one central place.
const router = express.Router();

router.get("/health", (_req, res) => {
  res.status(200).json(new ApiResponse("Backend connected successfully"));
});
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/shares", shareRoutes);

module.exports = router;
