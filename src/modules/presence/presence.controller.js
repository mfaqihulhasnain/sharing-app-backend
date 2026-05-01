import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import presenceService from "./presence.service.js";

const presenceController = {
  bootstrap: asyncHandler(async (req, res) => {
    const result = await presenceService.getBootstrap({
      ip: req.ip,
      authorizationHeader: req.headers.authorization,
      cookieHeader: req.headers.cookie,
    });

    if (result.setGuestCookie) {
      res.cookie(
        result.setGuestCookie.name,
        result.setGuestCookie.value,
        result.setGuestCookie.options
      );
    }

    res.status(200).json(
      new ApiResponse("Presence bootstrap retrieved", {
        topic: result.topic,
        viewer: result.viewer,
        presence: result.presence,
      })
    );
  }),
};

export default presenceController;
