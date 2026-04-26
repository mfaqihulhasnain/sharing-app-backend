import { z } from "zod";

const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const MAX_BCRYPT_PASSWORD_BYTES = 72;

const passwordField = z
  .string()
  .min(8)
  .refine(
    (password) => Buffer.byteLength(password, "utf8") <= MAX_BCRYPT_PASSWORD_BYTES,
    { message: `password must be ${MAX_BCRYPT_PASSWORD_BYTES} bytes or fewer` }
  )
  .regex(
    PASSWORD_POLICY_REGEX,
    "password must include uppercase, lowercase, number, and special character"
  );

const register = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email().max(150),
      password: passwordField,
    })
    .strict(),
});

const login = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email().max(150),
      password: passwordField,
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

const verifyEmail = z.object({
  body: z
    .object({
      token: z.string().trim().min(1),
    })
    .strict(),
});

const resendVerification = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email().max(150),
    })
    .strict(),
});

// Purpose: store auth request schemas close to the module boundary.
const authValidation = {
  register,
  login,
  refreshSession,
  logout,
  verifyEmail,
  resendVerification,
};

export default authValidation;
