import nodemailer from "nodemailer";
import { config } from "../core/config";
import { AppLogger } from "../core/logging/logger";

const LOGO_URL = "https://medicalexampro.com/images/headerlogo.png";

class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (!config.email.user || !config.email.pass) {
      AppLogger.warn(
        "Email credentials (SMTP_USER / SMTP_PASS) not configured. Real emails will not be sent."
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

      AppLogger.info(`SMTP Mail Service initialized with user: ${config.email.user} on port ${config.email.port}`);
    } catch (error) {
      AppLogger.error("Failed to initialize SMTP transporter:", { error });
    }
  }

  /**
   * Send Platform Account OTP (Verification or Password Reset)
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
      ? `Medical Exam Pro: Password Reset Code: ${otp}`
      : `Medical Exam Pro: Email Verification Code: ${otp}`;
    const actionText = isReset
      ? "We received a request to reset the password for your Medical Exam Pro account. Please use the verification code below to proceed:"
      : "Thank you for creating an account with Medical Exam Pro. Please verify your email address using the verification code below:";
    const recipientName = name && name.trim() ? name.trim() : "Candidate";

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #071729; padding: 28px 32px; text-align: center; border-bottom: 1px solid #1e3a5f;">
              <a href="https://medicalexampro.com" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${LOGO_URL}" alt="Medical Exam Pro" width="220" style="display: block; max-width: 220px; width: 100%; height: auto; margin: 0 auto; border: 0;" />
              </a>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #1e293b;">
                Dear ${recipientName},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #475569;">
                ${actionText}
              </p>
              
              <!-- OTP Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 24px 16px;">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #071729; line-height: 1;">
                      ${otp}
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500;">
                      This verification code expires in 10 minutes.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 20px; color: #64748b;">
                If you did not request this verification code, please ignore this email or contact our support team at <a href="mailto:contact@medicalexampro.com" style="color: #1D82EB; text-decoration: none;">contact@medicalexampro.com</a>.
              </p>

              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 13px; line-height: 20px; color: #475569;">
                  Kind regards,<br>
                  <strong>The Medical Exam Pro Team</strong><br>
                  <a href="https://medicalexampro.com" style="color: #1D82EB; text-decoration: none; font-size: 12px;">medicalexampro.com</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;">
                Medical Exam Pro &bull; UK MSRA &amp; Medical Recruitment Assessment Platform
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Medical Exam Pro. All rights reserved.
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

      AppLogger.info(`[Email Sent] MessageId: ${info.messageId} | To: ${to} | Subject: ${subject}`);
      return true;
    } catch (error) {
      AppLogger.error(`[Email Failed] Could not send OTP email to ${to}:`, { error });
      return false;
    }
  }

  /**
   * Send Pre-Registration OTP Verification Email
   */
  public async sendPreRegistrationOtpEmail(
    to: string,
    otp: string,
    name?: string
  ): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
      if (!this.transporter) {
        AppLogger.warn(`[MailService] Transporter unavailable. Pre-reg OTP for ${to} is: ${otp}`);
        return false;
      }
    }

    const subject = `Medical Exam Pro: Verification Code: ${otp}`;
    const displayName = name && name.trim() ? name.trim() : "Candidate";

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #071729; padding: 28px 32px; text-align: center; border-bottom: 1px solid #1e3a5f;">
              <a href="https://medicalexampro.com" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${LOGO_URL}" alt="Medical Exam Pro" width="220" style="display: block; max-width: 220px; width: 100%; height: auto; margin: 0 auto; border: 0;" />
              </a>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #1e293b;">
                Dear ${displayName},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #475569;">
                Thank you for pre-registering with <strong>Medical Exam Pro</strong>. Please use the 6-digit verification code below to confirm your email address and secure your early-bird registration:
              </p>
              
              <!-- OTP Box -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 24px 16px;">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #071729; line-height: 1;">
                      ${otp}
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b; font-weight: 500;">
                      This verification code expires in 10 minutes.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 20px; color: #475569;">
                Once verified, your early-bird discount will be reserved for our platform launch in November 2026.
              </p>

              <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 18px; color: #64748b;">
                If you did not initiate this pre-registration, please disregard this email.
              </p>

              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 13px; line-height: 20px; color: #475569;">
                  Kind regards,<br>
                  <strong>The Medical Exam Pro Team</strong><br>
                  <a href="https://medicalexampro.com" style="color: #1D82EB; text-decoration: none; font-size: 12px;">medicalexampro.com</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;">
                Medical Exam Pro &bull; UK MSRA &amp; Medical Recruitment Assessment Platform
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Medical Exam Pro. All rights reserved.
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

      AppLogger.info(`[Pre-Reg OTP Sent] MessageId: ${info.messageId} | To: ${to}`);
      return true;
    } catch (error) {
      AppLogger.error(`[Pre-Reg OTP Failed] Could not send OTP email to ${to}:`, { error });
      return false;
    }
  }

  /**
   * Send Pre-Registration Confirmation Email
   * (Displays official confirmation without queue numbers or remaining places)
   */
  public async sendPreRegistrationConfirmedEmail(
    to: string,
    data: {
      name?: string;
      queueNumber: number;
      isEligibleForDiscount: boolean;
      discountPercentage: number;
      discountCode: string;
    }
  ): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
      if (!this.transporter) return false;
    }

    const displayName = data.name && data.name.trim() ? data.name.trim() : "Candidate";
    const isDiscount = data.isEligibleForDiscount;
    const subject = isDiscount
      ? "Medical Exam Pro: 50% Launch Discount Confirmed"
      : "Medical Exam Pro: Pre-Registration Confirmed";

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #071729; padding: 28px 32px; text-align: center; border-bottom: 1px solid #1e3a5f;">
              <a href="https://medicalexampro.com" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${LOGO_URL}" alt="Medical Exam Pro" width="220" style="display: block; max-width: 220px; width: 100%; height: auto; margin: 0 auto; border: 0;" />
              </a>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #071729;">
                ${isDiscount ? "50% Launch Discount Confirmed" : "Pre-Registration Confirmed"}
              </h1>

              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #1e293b;">
                Dear ${displayName},
              </p>

              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #475569;">
                ${
                  isDiscount
                    ? "Thank you for pre-registering for Medical Exam Pro. Your email address has been verified, and your <strong>50% early-bird launch discount</strong> has been secured."
                    : "Thank you for pre-registering for Medical Exam Pro. Your email address has been verified, and you are confirmed on our official launch list."
                }
              </p>

              <!-- Confirmation Details Table -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; width: 40%;">
                    Status
                  </td>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #071729;">
                    ${isDiscount ? "50% Launch Discount Reserved" : "Launch Priority Confirmed"}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
                    Registered Email
                  </td>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #071729;">
                    ${to}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
                    Target Examination
                  </td>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #071729;">
                    UK MSRA (Clinical Problem Solving &amp; SJT)
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; font-size: 13px; color: #64748b;">
                    Official Launch
                  </td>
                  <td style="padding: 14px 20px; font-size: 13px; font-weight: 600; color: #071729;">
                    November 2026
                  </td>
                </tr>
              </table>

              <h2 style="margin: 28px 0 12px 0; font-size: 15px; font-weight: 700; color: #071729;">
                What happens next?
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #475569;">
                ${
                  isDiscount
                    ? `Ahead of our official launch in November 2026, we will email your exclusive early-access link and 50% discount details directly to <strong>${to}</strong> so you can immediately begin your MSRA preparation.`
                    : `Ahead of our official launch in November 2026, we will email your early-access invitation directly to <strong>${to}</strong>.`
                }
              </p>

              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 13px; line-height: 20px; color: #475569;">
                  Kind regards,<br>
                  <strong>The Medical Exam Pro Team</strong><br>
                  <a href="mailto:contact@medicalexampro.com" style="color: #1D82EB; text-decoration: none; font-size: 13px;">contact@medicalexampro.com</a><br>
                  <a href="https://medicalexampro.com" style="color: #1D82EB; text-decoration: none; font-size: 12px;">medicalexampro.com</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b;">
                Medical Exam Pro &bull; UK MSRA &amp; Medical Recruitment Assessment Platform
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Medical Exam Pro. All rights reserved.
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

      AppLogger.info(`[Pre-Reg Confirmed Sent] MessageId: ${info.messageId} | To: ${to}`);
      return true;
    } catch (error) {
      AppLogger.error(`[Pre-Reg Confirmed Failed] Could not send confirmation email to ${to}:`, { error });
      return false;
    }
  }
}

export const mailService = new MailService();
