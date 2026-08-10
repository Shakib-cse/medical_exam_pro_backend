import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      id: string;
      timedout?: boolean;
      abortSignal: AbortSignal;
      validatedBody?: any;
      validatedQuery?: any;
      validatedParams?: any;
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}
