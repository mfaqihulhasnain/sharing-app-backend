import { z } from "zod";

const register = z.object({
  body: z
    .object({
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
      email: z.string().trim().toLowerCase().email().max(150),
      password: z.string().min(8).max(72),
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
