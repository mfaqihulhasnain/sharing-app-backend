import nodemailer from "nodemailer";
import { env } from "../config/index.js";
import ApiError from "../utils/ApiError.js";

let transporter;

const ensureMailConfig = () => {
  if (!env.MAIL_HOST || !env.MAIL_USER || !env.MAIL_PASS) {
    throw new ApiError(
      500,
      "Email service is not configured. Please set MAIL_HOST, MAIL_USER, and MAIL_PASS.",
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

const getFromAddress = () =>
  env.MAIL_FROM || "Nearboards <no-reply@nearboards.local>";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const sendVerificationEmail = async ({
  to,
  name,
  verificationUrl,
  expiresAt,
}) => {
  const expiresLabel = expiresAt.toUTCString();
  const safeName = name || "there";
  const escapedName = escapeHtml(safeName);
  const escapedVerificationUrl = escapeHtml(verificationUrl);
  const escapedExpiresLabel = escapeHtml(expiresLabel);
  const logoUrl = new URL(
    "/nearboards-logo-email.png",
    verificationUrl,
  ).toString();
  const escapedLogoUrl = escapeHtml(logoUrl);
  const currentYear = new Date().getUTCFullYear();
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
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
    <title>Verify your email for Nearboards</title>
    <!--[if mso]>
      <noscript>
        <xml>
          <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
      </noscript>
    <![endif]-->
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell { width: 100% !important; }
        .mobile-gutter { padding-left: 20px !important; padding-right: 20px !important; }
        .hero-title { font-size: 30px !important; line-height: 36px !important; }
        .mobile-full { width: 100% !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; width:100%; background-color:#f1f5f9; color:#0f172a; font-family:'Segoe UI',Arial,Helvetica,sans-serif; -webkit-font-smoothing:antialiased;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all;">
      Your Nearboards account is ready. Verify your email to activate it.
    </div>
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">&#847;&zwnj;&nbsp;&#8199;&zwnj;&nbsp;&#65279;&zwnj;&nbsp;</div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse; background-color:#f1f5f9;">
      <tr>
        <td align="center" style="padding:36px 12px;">
          <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="width:100%; max-width:600px; border-collapse:separate; background-color:#ffffff; border:1px solid #e2e8f0; border-radius:24px; box-shadow:0 16px 42px rgba(15,23,42,0.08); overflow:hidden;">
            <tr>
              <td class="mobile-gutter" style="padding:24px 40px; background-color:#ffffff; border-bottom:1px solid #e2e8f0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td align="left" valign="middle">
                      <img src="${escapedLogoUrl}" width="165" height="36" alt="Nearboards" style="display:block; width:165px; height:36px; border:0; outline:none; text-decoration:none; color:#0f172a; font-size:20px; font-weight:700;">
                    </td>
                    <td align="right" valign="middle" style="padding-left:12px;">
                      <span style="display:inline-block; padding:7px 11px; border:1px solid #bfdbfe; border-radius:999px; background-color:#eff6ff; color:#2563eb; font-size:10px; line-height:12px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; white-space:nowrap;">Account setup</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="mobile-gutter" style="padding:48px 40px 44px; background-color:#0f172a; background-image:linear-gradient(135deg,#0f172a 0%,#152b50 100%);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="padding-bottom:20px;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td align="center" valign="middle" width="30" height="30" style="width:30px; height:30px; border-radius:15px; background-color:#dbeafe; color:#2563eb; font-size:16px; line-height:30px; font-weight:700;">&#10003;</td>
                          <td style="padding-left:10px; color:#bfdbfe; font-size:12px; line-height:18px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase;">Account created</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="hero-title" style="color:#ffffff; font-size:38px; line-height:44px; font-weight:700; letter-spacing:-1px;">Welcome to Nearboards,<br>${escapedName}.</td>
                  </tr>
                  <tr>
                    <td style="padding-top:18px; color:#cbd5e1; font-size:16px; line-height:26px;">Your account has been created successfully. One quick verification is all that stands between you and clearer team collaboration.</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="mobile-gutter" style="padding:40px 40px 18px; background-color:#ffffff;">
                <p style="margin:0; color:#0f172a; font-size:20px; line-height:28px; font-weight:700;">Confirm your email address</p>
                <p style="margin:10px 0 0; color:#64748b; font-size:15px; line-height:24px;">Please verify your email address to activate your Nearboards account and securely access your shared workspace.</p>
              </td>
            </tr>

            <tr>
              <td align="left" class="mobile-gutter" style="padding:14px 40px 24px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="mobile-full" style="border-collapse:separate;">
                  <tr>
                    <td align="center" bgcolor="#2563eb" style="border-radius:12px; box-shadow:0 8px 20px rgba(37,99,235,0.24);">
                      <!--[if mso]>
                        <v:roundrect href="${escapedVerificationUrl}" style="height:50px;v-text-anchor:middle;width:220px;" arcsize="24%" strokecolor="#2563eb" fillcolor="#2563eb">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;">Verify email address</center>
                        </v:roundrect>
                      <![endif]-->
                      <!--[if !mso]><!-- -->
                      <a href="${escapedVerificationUrl}" target="_blank" style="display:inline-block; padding:15px 27px; border:1px solid #2563eb; border-radius:12px; background-color:#2563eb; color:#ffffff; font-size:15px; line-height:18px; font-weight:700; text-decoration:none;">Verify email address&nbsp;&nbsp;&#8594;</a>
                      <!--<![endif]-->
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="mobile-gutter" style="padding:0 40px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:separate; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;">
                  <tr>
                    <td width="42" valign="top" style="width:42px; padding:16px 0 16px 16px; color:#2563eb; font-size:18px; line-height:22px;">&#9201;</td>
                    <td style="padding:15px 16px 15px 8px; color:#64748b; font-size:13px; line-height:20px;">
                      For your security, this verification link expires at<br>
                      <strong style="color:#0f172a; font-weight:600;">${escapedExpiresLabel}</strong>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="mobile-gutter" style="padding:0 40px 38px;">
                <p style="margin:0; color:#7b8ba1; font-size:12px; line-height:19px;">If the button does not work, copy and paste this link into your browser:</p>
                <p style="margin:7px 0 0; word-break:break-all; color:#2563eb; font-size:12px; line-height:19px;"><a href="${escapedVerificationUrl}" target="_blank" style="color:#2563eb; text-decoration:underline;">${escapedVerificationUrl}</a></p>
              </td>
            </tr>

            <tr>
              <td class="mobile-gutter" style="padding:24px 40px; background-color:#f8fafc; border-top:1px solid #e2e8f0;">
                <p style="margin:0; color:#64748b; font-size:12px; line-height:19px;">If you did not create this account, you can safely ignore this email. No account access will be granted until the email address is verified.</p>
                <p style="margin:16px 0 0; color:#94a3b8; font-size:11px; line-height:17px;">&copy; ${currentYear} Nearboards. All rights reserved.<br>Built for clear updates and better team coordination.</p>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;

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
