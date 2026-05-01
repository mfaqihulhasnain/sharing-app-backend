import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import userService from "./user.service.js";

// Purpose: host user request handlers and delegate work to the user service.
const userController = {
  listUsers: asyncHandler(async (req, res) => {
    const query = req.validatedQuery || req.query;
    const result = await userService.listUsers({
      userId: req.auth?.userId,
      q: query.q,
      page: query.page,
      limit: query.limit,
      includeMe: query.includeMe,
    });

    res.status(200).json(new ApiResponse("Users retrieved", result));
  }),

  getMe: asyncHandler(async (req, res) => {
    const user = await userService.getMe({
      userId: req.auth.userId,
    });

    res
      .status(200)
      .json(new ApiResponse("Current user profile retrieved", { user }));
  }),

  updateMe: asyncHandler(async (req, res) => {
    const user = await userService.updateMe({
      userId: req.auth.userId,
      name: req.body.name,
    });

    res.status(200).json(new ApiResponse("Profile updated", { user }));
  }),

  getUserById: asyncHandler(async (req, res) => {
    const user = await userService.getUserById({
      id: req.params.id,
    });

    res.status(200).json(new ApiResponse("User profile retrieved", { user }));
  }),
};

export default userController;
