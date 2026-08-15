import { Router } from "express";
import { MockExamController } from "./MockExamController";
import { authenticate, optionalAuthenticate } from "../../middleware/auth";

export function createMockExamRoutes(controller: MockExamController): Router {
  const router = Router();

  router.get("/", optionalAuthenticate, controller.getMockExams);
  router.get("/history", authenticate, controller.getExamHistory);
  router.get("/:id", optionalAuthenticate, controller.getMockExamById);
  router.post("/:id/start", authenticate, controller.startExam);
  router.post("/attempt/:attemptId/submit", authenticate, controller.submitExam);

  // Admin routes
  router.post("/", controller.createMockExam);
  router.put("/:id", controller.updateMockExam);
  router.delete("/:id", controller.deleteMockExam);

  return router;
}
