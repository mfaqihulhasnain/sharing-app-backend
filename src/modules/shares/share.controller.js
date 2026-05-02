import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import { buildPresenceTopic, resolvePresenceViewerContext } from "../presence/presence.identity.js";
import shareRealtime from "./share.realtime.js";
import shareService from "./share.service.js";

const applyGuestCookieIfNeeded = (res, setGuestCookie) => {
  if (!setGuestCookie) return;

  res.cookie(setGuestCookie.name, setGuestCookie.value, setGuestCookie.options);
};

// Purpose: host share request handlers and delegate work to the share service.
const shareController = {
  initUploads: asyncHandler(async (req, res) => {
    const { viewer, setGuestCookie } = await resolvePresenceViewerContext({
      authorizationHeader: req.headers.authorization,
      cookieHeader: req.headers.cookie,
    });
    const result = await shareService.initUploads({
      viewerActorId: viewer.actorId,
      files: req.body.files,
    });

    applyGuestCookieIfNeeded(res, setGuestCookie);
    res.status(201).json(new ApiResponse("Share uploads initialized", result));
  }),

  abortUploads: asyncHandler(async (req, res) => {
    const { viewer, setGuestCookie } = await resolvePresenceViewerContext({
      authorizationHeader: req.headers.authorization,
      cookieHeader: req.headers.cookie,
    });
    await shareService.abortUploads({
      viewerActorId: viewer.actorId,
      uploadIds: req.body.uploadIds,
    });

    applyGuestCookieIfNeeded(res, setGuestCookie);
    res.status(204).end();
  }),

  listShares: asyncHandler(async (req, res) => {
    const query = req.validatedQuery || req.query;
    const { viewer, setGuestCookie } = await resolvePresenceViewerContext({
      authorizationHeader: req.headers.authorization,
      cookieHeader: req.headers.cookie,
    });
    const result = await shareService.listShares({
      viewerActorId: viewer.actorId,
      limit: query.limit,
      before: query.before,
    });

    applyGuestCookieIfNeeded(res, setGuestCookie);
    res.status(200).json(new ApiResponse("Shares retrieved", result));
  }),

  createShare: asyncHandler(async (req, res) => {
    const { viewer, setGuestCookie } = await resolvePresenceViewerContext({
      authorizationHeader: req.headers.authorization,
      cookieHeader: req.headers.cookie,
    });
    const share = await shareService.createShare({
      viewer,
      text: req.body.text,
      audienceActorIds: req.body.audienceActorIds,
      uploadIds: req.body.uploadIds,
    });

    applyGuestCookieIfNeeded(res, setGuestCookie);

    const topic = buildPresenceTopic({
      ip: req.ip,
    });
    try {
      await shareRealtime.publishShareCreated({
        topic,
        share,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("[shares] Realtime publish failed:", error?.message || error);
    }

    res.status(201).json(new ApiResponse("Share created", { share }));
  }),

  getShareFileDownloadUrl: asyncHandler(async (req, res) => {
    const { viewer, setGuestCookie } = await resolvePresenceViewerContext({
      authorizationHeader: req.headers.authorization,
      cookieHeader: req.headers.cookie,
    });
    const result = await shareService.getShareFileDownloadUrl({
      id: req.params.id,
      viewerActorId: viewer.actorId,
    });

    applyGuestCookieIfNeeded(res, setGuestCookie);
    res.status(200).json(new ApiResponse("File download URL generated", result));
  }),

  deleteShare: asyncHandler(async (req, res) => {
    const { viewer, setGuestCookie } = await resolvePresenceViewerContext({
      authorizationHeader: req.headers.authorization,
      cookieHeader: req.headers.cookie,
    });
    const deletedShare = await shareService.deleteShare({
      id: req.params.id,
      viewerActorId: viewer.actorId,
    });

    applyGuestCookieIfNeeded(res, setGuestCookie);

    const topic = buildPresenceTopic({
      ip: req.ip,
    });
    try {
      await shareRealtime.publishShareDeleted({
        topic,
        id: deletedShare.id,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("[shares] Realtime delete publish failed:", error?.message || error);
    }

    res.status(204).end();
  }),
};

export default shareController;
