import { Router } from "express";
import { QuestionBankController } from "./QuestionBankController";
import { authenticate, optionalAuthenticate } from "../../middleware/auth";

export function createQuestionBankRoutes(controller: QuestionBankController): Router {
  const router = Router();

  router.get("/", optionalAuthenticate, controller.getAllQuestionBanks);
  router.get("/:id", optionalAuthenticate, controller.getQuestionBankById);

  // Attempt routes
  router.post("/:id/start", authenticate, controller.startBankAttempt);
  router.post("/attempt/:attemptId/submit", authenticate, controller.submitBankAttempt);

  // Admin routes
  router.post("/", controller.createQuestionBank);
  router.put("/:id", controller.updateQuestionBank);
  router.delete("/:id", controller.deleteQuestionBank);

  // Admin question management routes
  router.post("/:id/questions", controller.addQuestionToBank);
  router.delete("/questions/:questionId", controller.deleteQuestionFromBank);

  return router;
}

