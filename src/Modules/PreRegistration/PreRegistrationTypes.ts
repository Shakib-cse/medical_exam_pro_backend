import { z } from "zod";

export const RegisterPreRegSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type RegisterPreRegDto = z.infer<typeof RegisterPreRegSchema>;

export const VerifyPreRegOtpSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  code: z.string().length(6, "Verification code must be 6 digits"),
});

export type VerifyPreRegOtpDto = z.infer<typeof VerifyPreRegOtpSchema>;

export const ResendPreRegOtpSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
});

export type ResendPreRegOtpDto = z.infer<typeof ResendPreRegOtpSchema>;
