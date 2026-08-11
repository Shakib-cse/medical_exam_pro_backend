import nodemailer from "nodemailer";
import { config } from "../core/config";
import { AppLogger } from "../core/logging/logger";

class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (!config.email.user || !config.email.pass) {
      AppLogger.warn(
        "⚠️ Email credentials (SMTP_USER / SMTP_PASS) not configured. Real emails will not be sent."
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });

      AppLogger.info(`📧 SMTP Mail Service initialized with user: ${config.email.user}`);
    } catch (error) {
      AppLogger.error("Failed to initialize SMTP transporter:", { error });
    }
  }

  /**
   * Send OTP Verification or Password Reset Email
   */
  public async sendOtpEmail(
    to: string,
    otp: string,
    type: "verify_email" | "reset_password" = "reset_password",
    name?: string
  ): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
      if (!this.transporter) {
        AppLogger.warn(`[MailService] Transporter unavailable. OTP for ${to} is: ${otp}`);
        return false;
      }
    }

    const isReset = type === "reset_password";
    const subject = isReset
      ? `Password Reset Code: ${otp}`
      : `Email Verification Code: ${otp}`;
    const actionText = isReset
      ? "You requested to reset your password. Use the verification code below to proceed:"
      : "Thank you for registering. Please verify your email address using the code below:";

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560px" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Kawan Exam Portal</h1>
              <p style="margin: 6px 0 0 0; color: #d1fae5; font-size: 14px;">Secure Verification</p>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #334155;">
                Hello${name ? ` <strong>${name}</strong>` : ""},
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #475569;">
                ${actionText}
              </p>
              
              <!-- OTP Box -->
              <div style="background-color: #f1f5f9; border-radius: 12px; border: 1px dashed #cbd5e1; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace; display: inline-block; padding-left: 8px;">
                  ${otp}
                </span>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500;">
                  This code expires in <strong>10 minutes</strong>.
                </p>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 20px; color: #94a3b8;">
                ⚠️ If you did not request this verification code, please ignore this email or reach out to support if you have concerns.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Kawan. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    try {
      const info = await this.transporter.sendMail({
        from: config.email.from,
        to,
        subject,
        html: htmlContent,
      });

      AppLogger.info(`📧 [Email Sent] MessageId: ${info.messageId} | To: ${to} | Subject: ${subject}`);
      return true;
    } catch (error) {
      AppLogger.error(`❌ [Email Failed] Could not send OTP email to ${to}:`, { error });
      return false;
    }
  }
}

export const mailService = new MailService();
