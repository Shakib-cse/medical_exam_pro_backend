import { Router } from "express";
import { MockExamController } from "./MockExamController";
import { authenticate } from "../../middleware/auth";
import { Request, Response, NextFunction } from "express";

function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      return authenticate(req, res, next);
    } catch {
      // Ignore token errors for optional auth
    }
  }
  next();
}

export function createMockExamRoutes(controller: MockExamController): Router {
  const router = Router();

  router.get("/", optionalAuth, controller.getMockExams);
  router.get("/history", authenticate, controller.getExamHistory);
  router.get("/:id", optionalAuth, controller.getMockExamById);
  router.post("/:id/start", authenticate, controller.startExam);
  router.post("/attempt/:attemptId/submit", authenticate, controller.submitExam);

  // Admin routes
  router.post("/", controller.createMockExam);
  router.put("/:id", controller.updateMockExam);
  router.delete("/:id", controller.deleteMockExam);

  return router;
}
