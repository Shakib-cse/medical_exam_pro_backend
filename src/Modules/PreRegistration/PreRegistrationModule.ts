import { BaseModule } from "../../core/BaseModule";
import { PreRegistrationService } from "./PreRegistrationService";
import { PreRegistrationController } from "./PreRegistrationController";
import { createPreRegistrationRoutes } from "./preRegistrationRoutes";

export class PreRegistrationModule extends BaseModule {
  public readonly name = "PreRegistrationModule";
  public readonly version = "1.0.0";
  public readonly basePath = "/api/v1/preregistration";
  public readonly dependencies = [];

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const preRegService = new PreRegistrationService(prisma);
    this.registerService("PreRegistrationService", preRegService);
  }

  protected async setupControllers(): Promise<void> {
    const preRegService = this.getService<PreRegistrationService>("PreRegistrationService");
    const preRegController = new PreRegistrationController(preRegService);
    this.registerController("PreRegistrationController", preRegController);
  }

  protected async setupRoutes(): Promise<void> {
    const preRegController = this.getController<PreRegistrationController>("PreRegistrationController");
    const routes = createPreRegistrationRoutes(preRegController);
    this.router.use("/", routes);
  }
}
