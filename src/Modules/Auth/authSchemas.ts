import { z } from "zod";

export const registerSchema = {
  body: z.object({
    firstName: z.string().min(1, { message: "First name is required" }),
    lastName: z.string().min(1, { message: "Last name is required" }),
    email: z.string().email({ message: "Invalid email address" }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" }),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(1, { message: "Password is required" }),
  }),
};

export const verifyOtpSchema = {
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
    code: z
      .string()
      .length(6, { message: "Verification code must be 6 digits" }),
    type: z.enum(["verify_email", "reset_password"]),
  }),
};

export const resendOtpSchema = {
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
    type: z.enum(["verify_email", "reset_password"]),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
    code: z
      .string()
      .length(6, { message: "Verification code must be 6 digits" }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" }),
  }),
};

export type RegisterDto = z.infer<typeof registerSchema.body>;
export type LoginDto = z.infer<typeof loginSchema.body>;
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema.body>;
export type ResendOtpDto = z.infer<typeof resendOtpSchema.body>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema.body>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema.body>;

export const updateProfileSchema = {
  body: z.object({
    firstName: z.string().min(1, { message: "First name is required" }),
    lastName: z.string().min(1, { message: "Last name is required" }),
    bio: z.string().optional(),
    targetExam: z.string().optional(),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, { message: "Current password is required" }),
    newPassword: z.string().min(6, { message: "New password must be at least 6 characters" }),
  }),
};

export type UpdateProfileDto = z.infer<typeof updateProfileSchema.body>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema.body>;
