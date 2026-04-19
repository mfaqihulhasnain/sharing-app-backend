import { z } from "zod";

const register = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80),
      username: z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(30)
        .regex(/^[a-z0-9_]+$/, "username can include only letters, numbers, and _"),
      email: z.string().trim().toLowerCase().email().max(150),
      password: z
        .string()
        .min(8)
        .max(72)
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
          "password must include uppercase, lowercase, and a number"
        ),
    })
    .strict(),
});

const login = z.object({
  body: z
    .object({
      identifier: z.string().trim().min(3).max(150),
      password: z.string().min(1).max(72),
    })
    .strict(),
});

const refreshSession = z.object({
  body: z
    .object({
      refreshToken: z.string().trim().min(1).optional(),
    })
    .optional(),
});

const logout = z.object({
  body: z
    .object({
      refreshToken: z.string().trim().min(1).optional(),
    })
    .optional(),
});

// Purpose: store auth request schemas close to the module boundary.
const authValidation = {
  register,
  login,
  refreshSession,
  logout,
};

export default authValidation;
