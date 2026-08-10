import { Router } from "express";
import { QuestionBankController } from "./QuestionBankController";

export function createQuestionBankRoutes(controller: QuestionBankController): Router {
  const router = Router();

  router.get("/", controller.getAllQuestionBanks);
  router.get("/:id", controller.getQuestionBankById);

  // Admin routes
  router.post("/", controller.createQuestionBank);
  router.put("/:id", controller.updateQuestionBank);
  router.delete("/:id", controller.deleteQuestionBank);

  // Admin question management routes
  router.post("/:id/questions", controller.addQuestionToBank);
  router.delete("/questions/:questionId", controller.deleteQuestionFromBank);

  return router;
}
