import { BaseModule } from "@/core/BaseModule";
import { AuthService } from "./AuthService";
import { AuthController } from "./AuthController";
import { createAuthRoutes } from "./authRoutes";

export class AuthModule extends BaseModule {
  public readonly name = "AuthModule";
  public readonly version = "1.0.0";
  public readonly basePath = "/api/v1/auth";
  public readonly dependencies = [];

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const authService = new AuthService(prisma);
    this.registerService("AuthService", authService);
  }

  protected async setupControllers(): Promise<void> {
    const authService = this.getService<AuthService>("AuthService");
    const authController = new AuthController(authService);
    this.registerController("AuthController", authController);
  }

  protected async setupRoutes(): Promise<void> {
    const authController = this.getController<AuthController>("AuthController");
    const routes = createAuthRoutes(authController);
    this.router.use("/", routes);
  }
}
