import bcrypt from "bcrypt";
import { PrismaClient, AccountStatus } from "../../generated/prisma";
import { BadRequestError, ConflictError } from "../../core/errors/AppError";
import { AppLogger } from "../../core/logging/logger";
import { mailService } from "../../lib/email";
import {
  RegisterPreRegDto,
  VerifyPreRegOtpDto,
  ResendPreRegOtpDto,
} from "./PreRegistrationTypes";

interface OtpData {
  code: string;
  expiresAt: number;
}

const globalForPreRegOtp = globalThis as unknown as {
  preRegOtpStore?: Map<string, OtpData>;
};

const preRegOtpStore = globalForPreRegOtp.preRegOtpStore || new Map<string, OtpData>();

if (process.env.NODE_ENV !== "production") {
  globalForPreRegOtp.preRegOtpStore = preRegOtpStore;
}

export class PreRegistrationService {
  private get otpStore(): Map<string, OtpData> {
    return preRegOtpStore;
  }

  constructor(private prisma: PrismaClient) {}

  private async executeWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (
        retries > 0 &&
        (error?.message?.includes("terminated") ||
          error?.message?.includes("closed") ||
          error?.message?.includes("Connection"))
      ) {
        AppLogger.warn("Retrying database operation after connection drop...");
        return await this.executeWithRetry(fn, retries - 1);
      }
      throw error;
    }
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private parseNames(dto: RegisterPreRegDto): { firstName: string; lastName: string; fullName: string } {
    let firstName = (dto.firstName || "").trim();
    let lastName = (dto.lastName || "").trim();

    if (!firstName && dto.fullName) {
      const parts = dto.fullName.trim().split(/\s+/);
      firstName = parts[0] || "Candidate";
      lastName = parts.slice(1).join(" ") || "";
    } else if (!firstName) {
      firstName = "Candidate";
    }

    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    return { firstName, lastName, fullName };
  }

  private async getOrCreateDefaultRole(): Promise<string> {
    return this.executeWithRetry(async () => {
      let role = await this.prisma.role.findFirst({
        where: { name: "user" },
      });

      if (!role) {
        role = await this.prisma.role.findFirst({
          where: { name: "client" },
        });
      }

      if (!role) {
        role = await this.prisma.role.create({
          data: {
            name: "user",
            description: "Standard User Role",
          },
        });
      }

      return role.id;
    });
  }

  /**
   * Get pre-registration stats for landing page display
   */
  public async getStats() {
    return this.executeWithRetry(async () => {
      const totalVerified = await this.prisma.preRegistration.count({
        where: { isVerified: true },
      });

      const maxDiscountSpots = 100;
      const spotsRemaining = Math.max(0, maxDiscountSpots - totalVerified);
      const isDiscountAvailable = spotsRemaining > 0;

      return {
        totalRegistered: totalVerified,
        maxDiscountSpots,
        spotsRemaining,
        isDiscountAvailable,
        discountPercentage: 50,
      };
    });
  }

  /**
   * Register interest with Email, Name & Password (sends OTP)
   */
  public async register(dto: RegisterPreRegDto) {
    const email = dto.email.toLowerCase().trim();
    const { firstName, lastName, fullName } = this.parseNames(dto);

    return this.executeWithRetry(async () => {
      // 1. Check if user already exists in User table
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
        include: { preRegistration: true },
      });

      // 1a. If they already completed pre-registration and have a queue number
      if (
        (existingUser?.isPreRegistered && existingUser.preRegQueueNumber) ||
        (existingUser?.preRegistration?.isVerified && existingUser.preRegistration.queueNumber)
      ) {
        const queueNumber = existingUser.preRegQueueNumber || existingUser.preRegistration?.queueNumber;
        const isEligible = existingUser.preRegDiscountEligible || existingUser.preRegistration?.isEligibleForDiscount || false;
        const discountCode = existingUser.preRegDiscountCode || existingUser.preRegistration?.discountCode || "LAUNCH50";

        return {
          alreadyRegistered: true,
          message: "You have already completed pre-registration!",
          data: {
            email: existingUser.email,
            fullName: existingUser.displayName || `${existingUser.firstName} ${existingUser.lastName}`,
            queueNumber,
            isEligibleForDiscount: isEligible,
            discountPercentage: 50,
            discountCode,
          },
        };
      }

      // 1b. If the user already has an active, verified account in the User table
      if (existingUser && existingUser.status === AccountStatus.active && existingUser.emailVerifiedAt) {
        const verifiedCount = await this.prisma.preRegistration.count({
          where: { isVerified: true },
        });
        const assignedQueue = verifiedCount + 1;
        const isEligible = assignedQueue <= 100;
        const discountCode = "LAUNCH50";

        // Update User table directly with pre-registration status
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            isPreRegistered: true,
            preRegQueueNumber: assignedQueue,
            preRegDiscountEligible: isEligible,
            preRegDiscountCode: discountCode,
          },
        });

        // Upsert PreRegistration table
        await this.prisma.preRegistration.upsert({
          where: { email },
          create: {
            email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            fullName: existingUser.displayName || `${existingUser.firstName} ${existingUser.lastName}`,
            userId: existingUser.id,
            isVerified: true,
            verifiedAt: new Date(),
            queueNumber: assignedQueue,
            isEligibleForDiscount: isEligible,
            discountPercentage: 50,
            discountCode,
            status: "VERIFIED",
          },
          update: {
            userId: existingUser.id,
            isVerified: true,
            verifiedAt: new Date(),
            queueNumber: assignedQueue,
            isEligibleForDiscount: isEligible,
            discountPercentage: 50,
            discountCode,
            status: "VERIFIED",
          },
        });

        // Send confirmation email
        mailService.sendPreRegistrationConfirmedEmail(email, {
          name: existingUser.firstName,
          queueNumber: assignedQueue,
          isEligibleForDiscount: isEligible,
          discountPercentage: 50,
          discountCode,
        }).catch((err) => {
          AppLogger.error(`Failed to send pre-reg confirmation to existing user ${email}:`, { error: err });
        });

        return {
          alreadyRegistered: true,
          isExistingUser: true,
          message: isEligible
            ? "Welcome back! Your registration is confirmed with the 50% early-bird launch discount."
            : "Welcome back! Your registration is confirmed on the official launch waitlist.",
          data: {
            email: existingUser.email,
            fullName: existingUser.displayName || `${existingUser.firstName} ${existingUser.lastName}`,
            queueNumber: assignedQueue,
            isEligibleForDiscount: isEligible,
            discountPercentage: 50,
            discountCode,
          },
        };
      }

      // 2. New or unverified candidate: Hash password and find/create user record
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const defaultRoleId = await this.getOrCreateDefaultRole();

      let userId = existingUser?.id;

      if (existingUser) {
        const updatedUser = await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            firstName,
            lastName,
            displayName: fullName,
            password: hashedPassword,
          },
        });
        userId = updatedUser.id;
      } else {
        const newUser = await this.prisma.user.create({
          data: {
            email,
            firstName,
            lastName,
            displayName: fullName,
            password: hashedPassword,
            status: AccountStatus.pending_verification,
            roleId: defaultRoleId,
          },
        });
        userId = newUser.id;
      }

      // 3. Upsert PreRegistration record
      const preReg = await this.prisma.preRegistration.upsert({
        where: { email },
        create: {
          email,
          firstName,
          lastName,
          fullName,
          userId,
          status: "PENDING",
          isVerified: false,
        },
        update: {
          firstName,
          lastName,
          fullName,
          userId,
          status: "PENDING",
        },
      });

      // 4. Generate and store OTP code
      const otpCode = this.generateOtp();
      const otpExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      this.otpStore.set(email, {
        code: otpCode,
        expiresAt: otpExpiresAt,
      });

      AppLogger.info(`🔑 [Pre-Reg OTP Generated] Email: ${email} | Code: ${otpCode}`);

      // 5. Send OTP email via SMTP
      const emailSent = await mailService.sendPreRegistrationOtpEmail(
        email,
        otpCode,
        firstName
      );

      return {
        success: true,
        alreadyRegistered: false,
        requiresVerification: true,
        email,
        message: "Verification code sent to your email.",
        emailSent,
      };
    });
  }

  /**
   * Verify OTP and assign queue position + discount eligibility
   */
  public async verifyOtp(dto: VerifyPreRegOtpDto) {
    const email = dto.email.toLowerCase().trim();
    const stored = this.otpStore.get(email);

    if (!stored) {
      throw new BadRequestError("No verification code found for this email. Please request a new code.");
    }

    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(email);
      throw new BadRequestError("Verification code has expired. Please request a new code.");
    }

    if (stored.code !== dto.code.trim()) {
      throw new BadRequestError("Invalid 6-digit verification code. Please check and try again.");
    }

    // OTP is valid, remove from store
    this.otpStore.delete(email);

    return this.executeWithRetry(async () => {
      // Find current pre-registration
      const preReg = await this.prisma.preRegistration.findUnique({
        where: { email },
      });

      if (!preReg) {
        throw new BadRequestError("Registration record not found. Please start registration again.");
      }

      if (preReg.isVerified && preReg.queueNumber) {
        return {
          success: true,
          message: "Email already verified!",
          data: {
            email: preReg.email,
            fullName: preReg.fullName,
            queueNumber: preReg.queueNumber,
            isEligibleForDiscount: preReg.isEligibleForDiscount,
            discountPercentage: preReg.discountPercentage,
            discountCode: preReg.discountCode,
          },
        };
      }

      // Count already verified users to compute queue number
      const verifiedCount = await this.prisma.preRegistration.count({
        where: { isVerified: true },
      });

      const assignedQueue = verifiedCount + 1;
      const isEligible = assignedQueue <= 100;
      const discountPercentage = 50;
      const discountCode = "LAUNCH50";

      // Update PreRegistration
      const updatedPreReg = await this.prisma.preRegistration.update({
        where: { email },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          queueNumber: assignedQueue,
          isEligibleForDiscount: isEligible,
          discountPercentage,
          discountCode,
          status: "VERIFIED",
        },
      });

      // Also activate User account and set pre-registration fields directly on User
      if (preReg.userId) {
        await this.prisma.user.update({
          where: { id: preReg.userId },
          data: {
            status: AccountStatus.active,
            emailVerifiedAt: new Date(),
            isPreRegistered: true,
            preRegQueueNumber: assignedQueue,
            preRegDiscountEligible: isEligible,
            preRegDiscountCode: discountCode,
          },
        });
      }

      // Send confirmation email
      mailService.sendPreRegistrationConfirmedEmail(email, {
        name: preReg.firstName,
        queueNumber: assignedQueue,
        isEligibleForDiscount: isEligible,
        discountPercentage,
        discountCode,
      }).catch((err) => {
        AppLogger.error(`Failed to send pre-reg confirmation email to ${email}:`, { error: err });
      });

      const spotsRemaining = Math.max(0, 100 - assignedQueue);

      return {
        success: true,
        message: isEligible
          ? "Registration confirmed! You've secured the 50% early-bird launch discount."
          : "Registration confirmed on the official launch waitlist.",
        data: {
          email: updatedPreReg.email,
          fullName: updatedPreReg.fullName,
          queueNumber: assignedQueue,
          isEligibleForDiscount: isEligible,
          discountPercentage,
          discountCode,
          spotsRemaining,
        },
      };
    });
  }

  /**
   * Resend 6-digit OTP code
   */
  public async resendOtp(dto: ResendPreRegOtpDto) {
    const email = dto.email.toLowerCase().trim();

    return this.executeWithRetry(async () => {
      const preReg = await this.prisma.preRegistration.findUnique({
        where: { email },
      });

      if (!preReg) {
        throw new BadRequestError("No registration found for this email. Please register first.");
      }

      if (preReg.isVerified) {
        throw new ConflictError("This email has already been verified!");
      }

      const otpCode = this.generateOtp();
      const otpExpiresAt = Date.now() + 10 * 60 * 1000;

      this.otpStore.set(email, {
        code: otpCode,
        expiresAt: otpExpiresAt,
      });

      AppLogger.info(`🔑 [Pre-Reg OTP Resent] Email: ${email} | Code: ${otpCode}`);

      await mailService.sendPreRegistrationOtpEmail(
        email,
        otpCode,
        preReg.firstName
      );

      return {
        success: true,
        message: "A fresh 6-digit verification code has been sent to your email.",
      };
    });
  }

  /**
   * Get all pre-registered users (for Admin Dashboard)
   */
  public async getAllPreRegistrations() {
    return this.executeWithRetry(async () => {
      const records = await this.prisma.preRegistration.findMany({
        orderBy: [
          { isVerified: "desc" },
          { queueNumber: "asc" },
          { createdAt: "desc" },
        ],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      const totalVerified = records.filter((r) => r.isVerified).length;
      const totalDiscountEligible = records.filter((r) => r.isEligibleForDiscount).length;

      return {
        total: records.length,
        totalVerified,
        totalDiscountEligible,
        spotsRemaining: Math.max(0, 100 - totalVerified),
        records,
      };
    });
  }

  /**
   * Delete a pre-registered candidate and shift all subsequent candidates up
   */
  public async deletePreRegistration(id: string) {
    return this.executeWithRetry(async () => {
      const preReg = await this.prisma.preRegistration.findUnique({
        where: { id },
      });

      if (!preReg) {
        throw new BadRequestError("Pre-registration record not found");
      }

      const deletedQueueNumber = preReg.queueNumber;
      const wasVerified = preReg.isVerified;

      // 1. Delete the PreRegistration entry
      await this.prisma.preRegistration.delete({
        where: { id },
      });

      // 2. Also delete the User account from the database if linked (by userId or by email)!
      const userToDelete = preReg.userId
        ? await this.prisma.user.findUnique({ where: { id: preReg.userId } })
        : await this.prisma.user.findFirst({ where: { email: preReg.email } });

      if (userToDelete) {
        try {
          await this.prisma.user.delete({
            where: { id: userToDelete.id },
          });
        } catch {
          await this.prisma.user.update({
            where: { id: userToDelete.id },
            data: {
              isDeleted: true,
              deletedAt: new Date(),
              status: AccountStatus.inactive,
              isPreRegistered: false,
              preRegQueueNumber: null,
              preRegDiscountEligible: false,
              preRegDiscountCode: null,
            },
          }).catch(() => {});
        }
      }

      // 3. If the deleted record was verified with a queue number, shift all subsequent users up!
      if (wasVerified && deletedQueueNumber) {
        const subsequentUsers = await this.prisma.preRegistration.findMany({
          where: {
            isVerified: true,
            queueNumber: { gt: deletedQueueNumber },
          },
          orderBy: { queueNumber: "asc" },
        });

        for (const candidate of subsequentUsers) {
          if (candidate.queueNumber) {
            const newQueueNumber = candidate.queueNumber - 1;
            const isEligible = newQueueNumber <= 100;

            await this.prisma.preRegistration.update({
              where: { id: candidate.id },
              data: {
                queueNumber: newQueueNumber,
                isEligibleForDiscount: isEligible,
              },
            });

            if (candidate.userId) {
              await this.prisma.user.update({
                where: { id: candidate.userId },
                data: {
                  preRegQueueNumber: newQueueNumber,
                  preRegDiscountEligible: isEligible,
                },
              }).catch(() => {});
            }
          }
        }

        AppLogger.info(
          `🗑️ Pre-registration #${deletedQueueNumber} deleted (${preReg.email}). Shifted ${subsequentUsers.length} subsequent candidate(s) up.`
        );
      }

      return {
        success: true,
        message: `Candidate ${preReg.email} deleted successfully. Subsequent queue positions updated.`,
      };
    });
  }
}
