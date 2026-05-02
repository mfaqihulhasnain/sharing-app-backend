import {
  buildPresenceTopic,
  resolvePresenceViewerContext,
} from "./presence.identity.js";

const presenceService = {
  async getBootstrap({
    ip,
    authorizationHeader,
    cookieHeader,
  }) {
    const topic = buildPresenceTopic({ ip });
    const { viewer, guestId, setGuestCookie } = await resolvePresenceViewerContext({
      authorizationHeader,
      cookieHeader,
    });

    return {
      topic,
      viewer,
      presence: {
        presenceKeyBase: viewer.actorId,
        guestId: viewer.actorType === "guest" ? guestId : null,
      },
      setGuestCookie,
    };
  },
};

export default presenceService;
