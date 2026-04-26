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

const getFromAddress = () => env.MAIL_FROM || "Sharing Board <no-reply@sharing.local>";

const sendVerificationEmail = async ({ to, name, verificationUrl, expiresAt }) => {
  const expiresLabel = expiresAt.toUTCString();
  const safeName = name || "there";
  const subject = "Verify your email for Sharing Board";
  const text = [
    `Hi ${safeName},`,
    "",
    "Please verify your email address to activate your Sharing Board account.",
    `Verification link: ${verificationUrl}`,
    `This link expires at ${expiresLabel}.`,
    "",
    "If you did not create this account, you can ignore this email.",
  ].join("\n");
  const html = `
    <p>Hi ${safeName},</p>
    <p>Please verify your email address to activate your Sharing Board account.</p>
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

export { sendVerificationEmail };
