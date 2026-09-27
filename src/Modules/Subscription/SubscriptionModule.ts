import { BaseModule } from "../../core/BaseModule";
import { SubscriptionService } from "./SubscriptionService";
import { SubscriptionController } from "./SubscriptionController";
import { createSubscriptionRoutes } from "./subscriptionRoutes";

export class SubscriptionModule extends BaseModule {
  public readonly name = "SubscriptionModule";
  public readonly version = "1.0.0";
  public readonly basePath = "/api/v1/subscription";
  public readonly dependencies = [];

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const subscriptionService = new SubscriptionService(prisma);
    this.registerService("SubscriptionService", subscriptionService);
  }

  protected async setupControllers(): Promise<void> {
    const subscriptionService = this.getService<SubscriptionService>("SubscriptionService");
    const subscriptionController = new SubscriptionController(subscriptionService);
    this.registerController("SubscriptionController", subscriptionController);
  }

  protected async setupRoutes(): Promise<void> {
    const subscriptionController = this.getController<SubscriptionController>("SubscriptionController");
    const routes = createSubscriptionRoutes(subscriptionController);
    this.router.use("/", routes);
  }
}
