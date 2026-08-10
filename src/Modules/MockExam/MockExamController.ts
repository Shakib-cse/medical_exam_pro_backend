import { Request, Response } from "express";
import { MockExamService } from "./MockExamService";
import { AppLogger } from "@/core/logging/logger";

export class MockExamController {
  constructor(private readonly mockExamService: MockExamService) {}

  private getUserId(req: Request): string | undefined {
    return req.user?.userId || (req.user as any)?.id;
  }

  public getMockExams = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const data = await this.mockExamService.getMockExams(userId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      AppLogger.error("Failed to fetch mock exams:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch mock exams",
      });
    }
  };

  public getExamHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const data = await this.mockExamService.getExamHistory(userId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      AppLogger.error("Failed to fetch exam history:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch exam history",
      });
    }
  };

  public getMockExamById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data = await this.mockExamService.getMockExamById(id as string);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      AppLogger.error("Failed to fetch mock exam details:", { error });
      res.status(404).json({
        success: false,
        message: error.message || "Mock exam not found",
      });
    }
  };

  public startExam = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { id } = req.params;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const data = await this.mockExamService.startExamAttempt(userId, id as string);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      AppLogger.error("Failed to start mock exam:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to start mock exam",
      });
    }
  };

  public submitExam = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const { attemptId } = req.params;
      const { userAnswers, timeTakenSeconds } = req.body;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const data = await this.mockExamService.submitExamAttempt(userId, attemptId as string, {
        userAnswers: userAnswers || {},
        timeTakenSeconds: timeTakenSeconds || 0,
      });
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      AppLogger.error("Failed to submit mock exam:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to submit mock exam",
      });
    }
  };

  public createMockExam = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.mockExamService.createMockExam(req.body);
      res.status(201).json({
        success: true,
        data,
        message: "Mock exam created successfully",
      });
    } catch (error: any) {
      AppLogger.error("Failed to create mock exam:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to create mock exam",
      });
    }
  };

  public updateMockExam = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data = await this.mockExamService.updateMockExam(id as string, req.body);
      res.status(200).json({
        success: true,
        data,
        message: "Mock exam updated successfully",
      });
    } catch (error: any) {
      AppLogger.error("Failed to update mock exam:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update mock exam",
      });
    }
  };

  public deleteMockExam = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this.mockExamService.deleteMockExam(id as string);
      res.status(200).json({
        success: true,
        message: "Mock exam deleted successfully",
      });
    } catch (error: any) {
      AppLogger.error("Failed to delete mock exam:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete mock exam",
      });
    }
  };
}
