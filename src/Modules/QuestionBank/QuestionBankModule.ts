import { BaseModule } from "../../core/BaseModule";
import { QuestionBankService } from "./QuestionBankService";
import { QuestionBankController } from "./QuestionBankController";
import { createQuestionBankRoutes } from "./questionBankRoutes";

export class QuestionBankModule extends BaseModule {
  public readonly name = "QuestionBankModule";
  public readonly version = "1.0.0";
  public readonly basePath = "/api/v1/question-bank";
  public readonly dependencies = [];

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const questionBankService = new QuestionBankService(prisma);
    this.registerService("QuestionBankService", questionBankService);
  }

  protected async setupControllers(): Promise<void> {
    const questionBankService = this.getService<QuestionBankService>("QuestionBankService");
    const questionBankController = new QuestionBankController(questionBankService);
    this.registerController("QuestionBankController", questionBankController);
  }

  protected async setupRoutes(): Promise<void> {
    const questionBankController = this.getController<QuestionBankController>("QuestionBankController");
    const routes = createQuestionBankRoutes(questionBankController);
    this.router.use("/", routes);
  }
}
