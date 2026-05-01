const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  emailVerifiedAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const toPublicUser = (user) => {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const userModel = {
  userPublicSelect,
  toPublicUser,
};

export { userPublicSelect, toPublicUser };
export default userModel;
