import nodemailer from "nodemailer";
import { env } from "../config/index.js";
import ApiError from "../utils/ApiError.js";

let transporter;

const ensureMailConfig = () => {
  if (!env.MAIL_HOST || !env.MAIL_USER || !env.MAIL_PASS) {
    throw new ApiError(
      500,
      "Email service is not configured. Please set MAIL_HOST, MAIL_USER, and MAIL_PASS."
    );
  }
};

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  ensureMailConfig();

  transporter = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_SECURE,
    auth: {
      user: env.MAIL_USER,
      pass: env.MAIL_PASS,
    },
  });

  return transporter;
};

const getFromAddress = () => env.MAIL_FROM || "Nearboards <no-reply@nearboards.local>";

const sendVerificationEmail = async ({ to, name, verificationUrl, expiresAt }) => {
  const expiresLabel = expiresAt.toUTCString();
  const safeName = name || "there";
  const subject = "Verify your email for Nearboards";
  const text = [
    `Hi ${safeName},`,
    "",
    "Please verify your email address to activate your Nearboards account.",
    `Verification link: ${verificationUrl}`,
    `This link expires at ${expiresLabel}.`,
    "",
    "If you did not create this account, you can ignore this email.",
  ].join("\n");
  const html = `
    <p>Hi ${safeName},</p>
    <p>Please verify your email address to activate your Nearboards account.</p>
    <p><a href="${verificationUrl}">Verify email</a></p>
    <p>This link expires at <strong>${expiresLabel}</strong>.</p>
    <p>If you did not create this account, you can ignore this email.</p>
  `;

  const mailTransporter = getTransporter();
  await mailTransporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });
};

const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresAt }) => {
  const expiresLabel = expiresAt.toUTCString();
  const safeName = name || "there";
  const subject = "Reset your Nearboards password";
  const text = [
    `Hi ${safeName},`,
    "",
    "We received a request to reset your Nearboards password.",
    `Reset link: ${resetUrl}`,
    `This link expires at ${expiresLabel}.`,
    "",
    "If you did not request this reset, you can ignore this email.",
  ].join("\n");
  const html = `
    <p>Hi ${safeName},</p>
    <p>We received a request to reset your Nearboards password.</p>
    <p><a href="${resetUrl}">Reset password</a></p>
    <p>This link expires at <strong>${expiresLabel}</strong>.</p>
    <p>If you did not request this reset, you can ignore this email.</p>
  `;

  const mailTransporter = getTransporter();
  await mailTransporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });
};

export { sendVerificationEmail, sendPasswordResetEmail };

