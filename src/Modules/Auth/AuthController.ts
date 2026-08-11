import { Request, Response, NextFunction } from "express";
import { BaseController } from "../../core/BaseController";
import { AuthService } from "./AuthService";

export class AuthController extends BaseController {
  constructor(private authService: AuthService) {
    super();
  }

  public register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.register(req.validatedBody);
      return this.sendCreatedResponse(req, res, result, result.message);
    } catch (error) {
      next(error);
    }
  };

  public verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.verifyOtp(req.validatedBody);
      return this.sendResponse(req, res, result.message, 200, result);
    } catch (error) {
      next(error);
    }
  };

  public resendOtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.resendOtp(req.validatedBody);
      return this.sendResponse(req, res, result.message, 200, result);
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(req.validatedBody);
      return this.sendResponse(req, res, result.message, 200, result);
    } catch (error) {
      next(error);
    }
  };

  public forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.forgotPassword(req.validatedBody);
      return this.sendResponse(req, res, result.message, 200, result);
    } catch (error) {
      next(error);
    }
  };

  public resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.resetPassword(req.validatedBody);
      return this.sendResponse(req, res, result.message, 200, result);
    } catch (error) {
      next(error);
    }
  };

  public getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error("User ID missing from authenticated request");
      }
      const user = await this.authService.getCurrentUser(userId);
      return this.sendResponse(req, res, "User profile retrieved successfully", 200, { user });
    } catch (error) {
      next(error);
    }
  };

  public updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error("User ID missing from authenticated request");
      }
      const result = await this.authService.updateProfile(userId, req.validatedBody);
      return this.sendResponse(req, res, result.message, 200, result);
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new Error("User ID missing from authenticated request");
      }
      const result = await this.authService.changePassword(userId, req.validatedBody);
      return this.sendResponse(req, res, result.message, 200, result);
    } catch (error) {
      next(error);
    }
  };

  public getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await this.authService.getAllUsers();
      return this.sendResponse(req, res, "Users retrieved successfully", 200, users);
    } catch (error) {
      next(error);
    }
  };

  public updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = await this.authService.updateUserStatus(id as string, status);
      return this.sendResponse(req, res, "User status updated successfully", 200, user);
    } catch (error) {
      next(error);
    }
  };

  public deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.authService.deleteUser(id as string);
      return this.sendResponse(req, res, result.message, 200);
    } catch (error) {
      next(error);
    }
  };

  public createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.createUserByAdmin(req.body);
      return this.sendResponse(req, res, result.message, 201, result.user);
    } catch (error) {
      next(error);
    }
  };
}
