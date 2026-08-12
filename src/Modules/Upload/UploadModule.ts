import { BaseModule } from "../../core/BaseModule";
import { UploadService } from "./UploadService";
import { UploadController } from "./UploadController";
import { createUploadRoutes } from "./uploadRoutes";

export class UploadModule extends BaseModule {
  public readonly name = "UploadModule";
  public readonly version = "1.0.0";
  public readonly basePath = "/api/v1/upload";
  public readonly dependencies = [];

  protected async setupUseCases(): Promise<void> {
    const uploadService = new UploadService();
    this.registerService("UploadService", uploadService);
  }

  protected async setupControllers(): Promise<void> {
    const uploadService = this.getService<UploadService>("UploadService");
    const uploadController = new UploadController(uploadService);
    this.registerController("UploadController", uploadController);
  }

  protected async setupRoutes(): Promise<void> {
    const uploadController = this.getController<UploadController>("UploadController");
    const routes = createUploadRoutes(uploadController);
    this.router.use("/", routes);
  }
}
