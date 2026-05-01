import { toPublicUser } from "../users/user.model.js";

const PRESENCE_USER_PREFIX = "u:";
const PRESENCE_GUEST_PREFIX = "g:";
const DEFAULT_GUEST_NAME = "Guest";

const toPresenceViewerFromUser = (user) => {
  const publicUser = toPublicUser(user);

  return {
    actorType: "user",
    actorId: `${PRESENCE_USER_PREFIX}${publicUser.id}`,
    name: publicUser.name,
    user: publicUser,
  };
};

const toPresenceViewerFromGuest = ({ guestId }) => ({
  actorType: "guest",
  actorId: `${PRESENCE_GUEST_PREFIX}${guestId}`,
  name: DEFAULT_GUEST_NAME,
  user: null,
});

const presenceModel = {
  PRESENCE_USER_PREFIX,
  PRESENCE_GUEST_PREFIX,
  DEFAULT_GUEST_NAME,
  toPresenceViewerFromUser,
  toPresenceViewerFromGuest,
};

export {
  PRESENCE_USER_PREFIX,
  PRESENCE_GUEST_PREFIX,
  DEFAULT_GUEST_NAME,
  toPresenceViewerFromUser,
  toPresenceViewerFromGuest,
};

export default presenceModel;
