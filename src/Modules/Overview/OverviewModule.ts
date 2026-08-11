import { BaseModule } from "../../core/BaseModule";
import { OverviewService } from "./OverviewService";
import { OverviewController } from "./OverviewController";
import { createOverviewRoutes } from "./overviewRoutes";

export class OverviewModule extends BaseModule {
  public readonly name = "OverviewModule";
  public readonly version = "1.0.0";
  public readonly basePath = "/api/v1/overview";
  public readonly dependencies = [];

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const overviewService = new OverviewService(prisma);
    this.registerService("OverviewService", overviewService);
  }

  protected async setupControllers(): Promise<void> {
    const overviewService = this.getService<OverviewService>("OverviewService");
    const overviewController = new OverviewController(overviewService);
    this.registerController("OverviewController", overviewController);
  }

  protected async setupRoutes(): Promise<void> {
    const overviewController = this.getController<OverviewController>("OverviewController");
    const routes = createOverviewRoutes(overviewController);
    this.router.use("/", routes);
  }
}
