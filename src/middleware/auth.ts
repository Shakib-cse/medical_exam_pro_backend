import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../core/config";
import { AuthenticationError } from "../core/errors/AppError";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError("Authentication token is required");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new AuthenticationError("Authentication token is missing");
    }

    const secret = config.security.jwt.secret || "default-secret";
    const decoded = jwt.verify(token, secret) as JwtPayload;

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError("Invalid or expired authentication token"));
    } else {
      next(error);
    }
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token) {
        const secret = config.security.jwt.secret || "default-secret";
        const decoded = jwt.verify(token, secret) as JwtPayload;
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
        };
      }
    }
  } catch (_) {
    // Ignore invalid token in optional auth middleware
  }
  next();
}
