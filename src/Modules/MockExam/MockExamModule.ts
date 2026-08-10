import { BaseModule } from "@/core/BaseModule";
import { MockExamService } from "./MockExamService";
import { MockExamController } from "./MockExamController";
import { createMockExamRoutes } from "./mockExamRoutes";

export class MockExamModule extends BaseModule {
  public readonly name = "MockExamModule";
  public readonly version = "1.0.0";
  public readonly basePath = "/api/v1/mock-exams";
  public readonly dependencies = [];

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const mockExamService = new MockExamService(prisma);
    this.registerService("MockExamService", mockExamService);
  }

  protected async setupControllers(): Promise<void> {
    const mockExamService = this.getService<MockExamService>("MockExamService");
    const mockExamController = new MockExamController(mockExamService);
    this.registerController("MockExamController", mockExamController);
  }

  protected async setupRoutes(): Promise<void> {
    const mockExamController = this.getController<MockExamController>("MockExamController");
    const routes = createMockExamRoutes(mockExamController);
    this.router.use("/", routes);
  }
}
