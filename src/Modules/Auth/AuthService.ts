import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { PrismaClient, AccountStatus } from "../../generated/prisma";
import { config } from "../../core/config";
import {
  AuthenticationError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../core/errors/AppError";
import { AppLogger } from "../../core/logging/logger";
import { mailService } from "../../lib/email";
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from "./authSchemas";

interface OtpData {
  code: string;
  type: "verify_email" | "reset_password";
  expiresAt: number;
}

const globalForOtp = globalThis as unknown as {
  otpStore?: Map<string, OtpData>;
};

const otpStore = globalForOtp.otpStore || new Map<string, OtpData>();

if (process.env.NODE_ENV !== "production") {
  globalForOtp.otpStore = otpStore;
}

export class AuthService {
  private get otpStore(): Map<string, OtpData> {
    return otpStore;
  }

  constructor(private prisma: PrismaClient) {
    this.seedDefaultAdmin().catch((err) => AppLogger.error("Failed to seed default admin:", { error: err }));
  }

  private async seedDefaultAdmin() {
    try {
      const adminEmail = "admin@example.com";
      const existing = await this.prisma.user.findFirst({ where: { email: adminEmail } });
      if (!existing) {
        let adminRole = await this.prisma.role.findFirst({ where: { name: "admin" } });
        if (!adminRole) {
          adminRole = await this.prisma.role.create({
            data: { name: "admin", description: "Administrator Role" },
          });
        }
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await this.prisma.user.create({
          data: {
            email: adminEmail,
            firstName: "System",
            lastName: "Administrator",
            password: hashedPassword,
            status: AccountStatus.active,
            roleId: adminRole.id,
          },
        });
        AppLogger.info("🔑 Default admin user seeded: admin@example.com / admin123");
      }
    } catch (err) {
      // Ignore if seeding fails transiently
    }
  }

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

  private getOtpKey(email: string, type: string): string {
    return `${email.toLowerCase().trim()}:${type}`;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user;
    return sanitized;
  }

  private generateToken(user: { id: string; email: string; role: { name: string } }): string {
    const secret = config.security.jwt.secret || "default-secret";
    const signOptions: SignOptions = {
      expiresIn: (config.security.jwt.expiresIn || "1d") as SignOptions["expiresIn"],
      issuer: config.security.jwt.issuer || "ignitor-app",
    };

    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role?.name || "user",
      },
      secret,
      signOptions
    );
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
   * Register a new user (Requires email OTP verification)
   */
  public async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.executeWithRetry(async () => {
      return this.prisma.user.findFirst({
        where: { email },
      });
    });

    const defaultRoleId = await this.getOrCreateDefaultRole();
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    let user;

    if (existingUser) {
      if (existingUser.status === AccountStatus.active && existingUser.emailVerifiedAt) {
        throw new ConflictError("An account with this email already exists. Please log in.");
      }
      // Update unverified user with new credentials
      user = await this.executeWithRetry(async () => {
        return this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            displayName: `${dto.firstName} ${dto.lastName}`,
            password: hashedPassword,
            status: AccountStatus.pending_verification,
          },
          include: {
            role: true,
          },
        });
      });
    } else {
      user = await this.executeWithRetry(async () => {
        return this.prisma.user.create({
          data: {
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            displayName: `${dto.firstName} ${dto.lastName}`,
            password: hashedPassword,
            status: AccountStatus.pending_verification,
            emailVerifiedAt: null,
            roleId: defaultRoleId,
          },
          include: {
            role: true,
          },
        });
      });
    }

    const otpCode = this.generateOtp();
    const otpKey = this.getOtpKey(email, "verify_email");
    this.otpStore.set(otpKey, {
      code: otpCode,
      type: "verify_email",
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    AppLogger.info(`🔑 [OTP Verify Email Generated] Email: ${email} | Code: ${otpCode}`);

    // Send real verification email via SMTP
    await mailService.sendOtpEmail(
      email,
      otpCode,
      "verify_email",
      dto.firstName || undefined
    );

    return {
      message: "Registration successful! A verification code has been sent to your email.",
      requiresVerification: true,
      email: user.email,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Verify 6-digit OTP code
   */
  public async verifyOtp(dto: VerifyOtpDto) {
    const email = dto.email.toLowerCase().trim();
    const otpKey = this.getOtpKey(email, dto.type);
    const otpData = this.otpStore.get(otpKey);

    if (!otpData) {
      throw new BadRequestError("No verification code found for this email. Please request a new code.");
    }

    if (Date.now() > otpData.expiresAt) {
      this.otpStore.delete(otpKey);
      throw new BadRequestError("Verification code has expired. Please request a new code.");
    }

    if (otpData.code !== dto.code) {
      throw new BadRequestError("Invalid verification code. Please check and try again.");
    }

    const user = await this.executeWithRetry(async () => {
      return this.prisma.user.findFirst({
        where: { email },
        include: { role: true },
      });
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (dto.type === "verify_email") {
      // Activate user account
      const updatedUser = await this.executeWithRetry(async () => {
        return this.prisma.user.update({
          where: { id: user.id },
          data: {
            status: AccountStatus.active,
            emailVerifiedAt: new Date(),
          },
          include: { role: true },
        });
      });

      this.otpStore.delete(otpKey);

      return {
        message: "Email verified successfully! You can now log in.",
        verified: true,
        user: this.sanitizeUser(updatedUser),
      };
    } else {
      // Password reset OTP verification
      return {
        message: "Code verified successfully. You can now reset your password.",
        verified: true,
      };
    }
  }

  /**
   * Resend OTP code
   */
  public async resendOtp(dto: ResendOtpDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.executeWithRetry(async () => {
      return this.prisma.user.findFirst({
        where: { email },
      });
    });

    if (!user) {
      throw new NotFoundError("User account not found");
    }

    const otpCode = this.generateOtp();
    const otpKey = this.getOtpKey(email, dto.type);
    this.otpStore.set(otpKey, {
      code: otpCode,
      type: dto.type,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    AppLogger.info(`🔑 [OTP Code Resent] Email: ${email} | Type: ${dto.type} | Code: ${otpCode}`);

    // Send real email via SMTP
    await mailService.sendOtpEmail(
      email,
      otpCode,
      dto.type,
      user.firstName || undefined
    );

    return {
      message: "A new verification code has been generated and sent to your email.",
      otpCode: config.server.env === "development" ? otpCode : undefined,
    };
  }

  /**
   * Authenticate user with Email and Password
   */
  public async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.executeWithRetry(async () => {
      return this.prisma.user.findFirst({
        where: { email },
        include: { role: true },
      });
    });

    if (!user) {
      throw new AuthenticationError("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new AuthenticationError("Invalid email or password");
    }

    if (user.status === AccountStatus.suspended) {
      throw new AuthenticationError("Your account has been suspended. Please contact support.");
    }

    if (user.status === AccountStatus.pending_verification || !user.emailVerifiedAt) {
      throw new AuthenticationError("Your email has not been verified yet. Please verify your email before logging in.");
    }

    // Update last login timestamp
    await this.executeWithRetry(async () => {
      return this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    });

    const token = this.generateToken(user);

    return {
      message: "Login successful",
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Send Forgot Password OTP
   */
  public async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.executeWithRetry(async () => {
      return this.prisma.user.findFirst({
        where: { email },
      });
    });

    if (user) {
      const otpCode = this.generateOtp();
      const otpKey = this.getOtpKey(email, "reset_password");
      this.otpStore.set(otpKey, {
        code: otpCode,
        type: "reset_password",
        expiresAt: Date.now() + 10 * 60 * 1000,
      });

      AppLogger.info(`🔑 [OTP Reset Password Generated] Email: ${email} | Code: ${otpCode}`);

      // Send real email via SMTP
      await mailService.sendOtpEmail(
        email,
        otpCode,
        "reset_password",
        user.firstName || undefined
      );
    }

    return {
      message: "If an account exists with this email, a 6-digit verification code has been sent to your inbox.",
    };
  }

  /**
   * Reset Password with OTP Code
   */
  public async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const otpKey = this.getOtpKey(email, "reset_password");
    const otpData = this.otpStore.get(otpKey);

    if (!otpData) {
      throw new BadRequestError("No valid reset request found or code expired. Please request a new code.");
    }

    if (Date.now() > otpData.expiresAt) {
      this.otpStore.delete(otpKey);
      throw new BadRequestError("Verification code has expired. Please request a new code.");
    }

    if (otpData.code !== dto.code) {
      throw new BadRequestError("Invalid verification code.");
    }

    const user = await this.executeWithRetry(async () => {
      return this.prisma.user.findFirst({
        where: { email },
      });
    });

    if (!user) {
      throw new NotFoundError("User account not found");
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.executeWithRetry(async () => {
      return this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });
    });

    this.otpStore.delete(otpKey);

    return {
      message: "Password has been successfully updated. Please log in with your new password.",
    };
  }

  /**
   * Update Profile Details
   */
  public async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.executeWithRetry(async () => {
      return this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          displayName: `${dto.firstName} ${dto.lastName}`,
          bio: dto.bio,
          targetExam: dto.targetExam,
        },
        include: { role: true },
      });
    });

    return {
      message: "Profile updated successfully",
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Change Password (for logged-in users)
   */
  public async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.executeWithRetry(async () => {
      return this.prisma.user.findFirst({
        where: { id: userId },
      });
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestError("The current password you entered is incorrect");
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.executeWithRetry(async () => {
      return this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
    });

    return {
      message: "Password updated successfully",
    };
  }

  /**
   * Get current authenticated user details
   */
  public async getCurrentUser(userId: string) {
    const user = await this.executeWithRetry(async () => {
      return this.prisma.user.findFirst({
        where: { id: userId },
        include: { role: true },
      });
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return this.sanitizeUser(user);
  }

  /**
   * Admin: Get all registered users
   */
  public async getAllUsers() {
    const users = await this.executeWithRetry(async () => {
      return this.prisma.user.findMany({
        where: { isDeleted: false },
        include: { role: true },
        orderBy: { createdAt: "desc" },
      });
    });

    return users.map((u) => this.sanitizeUser(u));
  }

  /**
   * Admin: Update user account status
   */
  public async updateUserStatus(userId: string, status: AccountStatus) {
    const user = await this.executeWithRetry(async () => {
      return this.prisma.user.findUnique({ where: { id: userId } });
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const updated = await this.executeWithRetry(async () => {
      return this.prisma.user.update({
        where: { id: userId },
        data: { status },
        include: { role: true },
      });
    });

    return this.sanitizeUser(updated);
  }

  /**
   * Admin: Delete user
   */
  public async deleteUser(userId: string) {
    const user = await this.executeWithRetry(async () => {
      return this.prisma.user.findUnique({ where: { id: userId } });
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    await this.executeWithRetry(async () => {
      return this.prisma.user.update({
        where: { id: userId },
        data: { isDeleted: true, deletedAt: new Date() },
      });
    });

    return { message: "User deleted successfully" };
  }

  /**
   * Admin: Create a new user account with specified role
   */
  public async createUserByAdmin(payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    roleName?: string;
    targetExam?: string;
  }) {
    const email = payload.email.toLowerCase().trim();

    const existingUser = await this.executeWithRetry(async () => {
      return this.prisma.user.findFirst({ where: { email } });
    });

    if (existingUser) {
      throw new ConflictError("A user with this email address already exists");
    }

    const roleName = payload.roleName || "user";
    let role = await this.executeWithRetry(async () => {
      return this.prisma.role.findFirst({ where: { name: roleName } });
    });

    if (!role) {
      role = await this.executeWithRetry(async () => {
        return this.prisma.role.create({
          data: { name: roleName, description: `${roleName} Role` },
        });
      });
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);

    const newUser = await this.executeWithRetry(async () => {
      return this.prisma.user.create({
        data: {
          email,
          firstName: payload.firstName,
          lastName: payload.lastName,
          displayName: `${payload.firstName} ${payload.lastName}`,
          password: hashedPassword,
          status: AccountStatus.active,
          roleId: role.id,
          targetExam: payload.targetExam || null,
          emailVerifiedAt: new Date(),
        },
        include: { role: true },
      });
    });

    return {
      message: `User created successfully with ${roleName} role`,
      user: this.sanitizeUser(newUser),
    };
  }
}
