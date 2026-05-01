import prisma from "../../lib/prisma.js";
import ApiError from "../../utils/ApiError.js";
import { toPublicUser, userPublicSelect } from "./user.model.js";

const DIRECTORY_PAGE_SIZE_DEFAULT = 20;

const buildDirectoryWhere = ({ userId, includeMe, query }) => {
  const normalizedQuery = query.trim();
  const shouldExcludeRequester =
    !includeMe && Number.isInteger(userId);

  return {
    emailVerifiedAt: {
      not: null,
    },
    ...(shouldExcludeRequester ? { id: { not: userId } } : {}),
    ...(normalizedQuery
      ? {
          OR: [
            {
              name: {
                contains: normalizedQuery,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: normalizedQuery,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };
};

const getPaginationMeta = ({ page, limit, total }) => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
};

// Purpose: contain user business rules without touching Express req/res objects.
const userService = {
  async listUsers({
    userId,
    q = "",
    page = 1,
    limit = DIRECTORY_PAGE_SIZE_DEFAULT,
    includeMe = false,
  }) {
    const where = buildDirectoryWhere({
      userId,
      includeMe,
      query: q,
    });
    const skip = (page - 1) * limit;

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: userPublicSelect,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip,
        take: limit,
      }),
    ]);

    return {
      users: users.map((user) => toPublicUser(user)),
      pagination: getPaginationMeta({ page, limit, total }),
    };
  },

  async getMe({ userId }) {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: userPublicSelect,
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return toPublicUser(user);
  },

  async updateMe({ userId, name }) {
    const existingUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

    if (!existingUser) {
      throw new ApiError(404, "User not found");
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name,
      },
      select: userPublicSelect,
    });

    return toPublicUser(user);
  },

  async getUserById({ id }) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        emailVerifiedAt: {
          not: null,
        },
      },
      select: userPublicSelect,
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return toPublicUser(user);
  },
};

export default userService;
