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

    const subject = `Your MedicalExamPro Verification Code: ${otp}`;
    const displayName = name ? name.trim() : "Future Medical Professional";

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030d17; color: #e2e8f0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #030d17; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #071729; border-radius: 16px; border: 1px solid #1e3a5f; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #092347 0%, #030e1c 100%); padding: 36px 30px; text-align: center; border-bottom: 1px solid #1D82EB33;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #1D82EB;">Medical</span>Exam<span style="color: #FF6B00;">Pro</span>
              </h1>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 13px; font-weight: 500; letter-spacing: 0.5px;">
                UK MSRA & MEDICAL RECRUITMENT EXAM PLATFORM
              </p>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; background-color: #0c2d54; border: 1px solid #1D82EB55; border-radius: 9999px; padding: 4px 14px; margin-bottom: 20px;">
                <span style="color: #60a5fa; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                  🚀 Early-Bird Pre-Registration
                </span>
              </div>

              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                Verify your email address
              </h2>

              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #cbd5e1;">
                Hello <strong>${displayName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #94a3b8;">
                Thank you for pre-registering for <strong>MedicalExamPro</strong>! Enter the 6-digit verification code below to verify your email and reserve your <strong>50% launch discount</strong> (reserved for the first 100 registrations):
              </p>
              
              <!-- OTP Box -->
              <div style="background-color: #030d17; border-radius: 12px; border: 1.5px dashed #1D82EB; padding: 24px; text-align: center; margin: 28px 0;">
                <span style="font-size: 40px; font-weight: 800; letter-spacing: 10px; color: #38bdf8; font-family: monospace; display: inline-block; padding-left: 10px;">
                  ${otp}
                </span>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">
                  ⏱ This code expires in <strong style="color: #f1f5f9;">10 minutes</strong>.
                </p>
              </div>

              <div style="background-color: #0b223d; border-left: 4px solid #FF6B00; border-radius: 4px 8px 8px 4px; padding: 14px 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 13px; line-height: 20px; color: #cbd5e1;">
                  💡 <strong>Early-Bird Perk:</strong> The first 100 verified users will receive a 50% discount on their first subscription when we launch in November 2026.
                </p>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 18px; color: #64748b;">
                If you did not initiate this pre-registration, please disregard this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #030d17; padding: 24px 30px; text-align: center; border-top: 1px solid #1e3a5f;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                Launching November 2026 &bull; Medical Exam Pro
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; 2026 Medical Exam Pro. All rights reserved.
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

      AppLogger.info(`📧 [Pre-Reg OTP Sent] MessageId: ${info.messageId} | To: ${to}`);
      return true;
    } catch (error) {
      AppLogger.error(`❌ [Pre-Reg OTP Failed] Could not send OTP email to ${to}:`, { error });
      return false;
    }
  }

  /**
   * Send Pre-Registration Confirmation Email
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

    const displayName = data.name ? data.name.trim() : "Future Medical Professional";
    const isDiscount = data.isEligibleForDiscount;
    const subject = isDiscount
      ? `🎉 Spot #${data.queueNumber} Confirmed — 50% Launch Discount Secured!`
      : `Spot #${data.queueNumber} Confirmed — Medical Exam Pro Launch Waitlist`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030d17; color: #e2e8f0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #030d17; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #071729; border-radius: 16px; border: 1px solid #1e3a5f; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #092347 0%, #030e1c 100%); padding: 36px 30px; text-align: center; border-bottom: 1px solid #1D82EB33;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                <span style="color: #1D82EB;">Medical</span>Exam<span style="color: #FF6B00;">Pro</span>
              </h1>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 13px; font-weight: 500; letter-spacing: 0.5px;">
                UK MSRA & CLINICAL RECRUITMENT EXAMS
              </p>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #ffffff;">
                ${isDiscount ? "🎉 Congratulations! Your 50% discount is secured." : "Welcome to the MedicalExamPro Waitlist!"}
              </h2>

              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #cbd5e1;">
                Hello <strong>${displayName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #94a3b8;">
                ${
                  isDiscount
                    ? `You are officially confirmed as <strong>Spot #${data.queueNumber} of 100</strong> for our exclusive early-bird launch!`
                    : `Your email is verified! You are confirmed as <strong>Spot #${data.queueNumber}</strong> on our launch waitlist.`
                }
              </p>

              <!-- Reservation Card -->
              <div style="background: linear-gradient(135deg, #0c2d54 0%, #081d38 100%); border-radius: 12px; border: 1px solid #1D82EB; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 13px; font-weight: 600; color: #60a5fa; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">
                  Reserved Queue Position
                </span>
                <span style="font-size: 42px; font-weight: 800; color: #ffffff; display: block;">
                  #${data.queueNumber} <span style="font-size: 20px; color: #94a3b8; font-weight: 400;">/ 100</span>
                </span>
                
                ${
                  isDiscount
                    ? `
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #1e3a5f;">
                      <span style="background-color: #FF6B00; color: #ffffff; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 6px; display: inline-block;">
                        50% LAUNCH DISCOUNT RESERVED
                      </span>
                      <p style="margin: 10px 0 0 0; font-size: 13px; color: #cbd5e1;">
                        Your exclusive 50% discount access will be delivered directly to this email when we go live.
                      </p>
                    </div>
                    `
                    : ""
                }
              </div>

              <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 22px; color: #cbd5e1;">
                <strong>What happens next?</strong><br/>
                When MedicalExamPro goes live in <strong>November 2026</strong>, we will email you at <strong>${to}</strong> with your personal early-access link and 50% discount details so you can immediately begin your MSRA preparation.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #030d17; padding: 24px 30px; text-align: center; border-top: 1px solid #1e3a5f;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                &copy; 2026 Medical Exam Pro. All rights reserved.
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

      AppLogger.info(`📧 [Pre-Reg Confirmed Sent] MessageId: ${info.messageId} | To: ${to}`);
      return true;
    } catch (error) {
      AppLogger.error(`❌ [Pre-Reg Confirmed Failed] Could not send confirmation email to ${to}:`, { error });
      return false;
    }
  }
}

export const mailService = new MailService();

