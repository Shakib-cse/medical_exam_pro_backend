import { Request, Response } from "express";
import { QuestionBankService } from "./QuestionBankService";
import { AppLogger } from "@/core/logging/logger";

export class QuestionBankController {
  constructor(private readonly service: QuestionBankService) { }

  private getUserId(req: Request): string | undefined {
    return req.user?.userId || (req.user as any)?.id;
  }

  public getAllQuestionBanks = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const data = await this.service.getAllQuestionBanks(userId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      AppLogger.error("Failed to fetch question banks:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch question banks",
      });
    }
  };

  public getQuestionBankById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data = await this.service.getQuestionBankById(id as string);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      AppLogger.error("Failed to fetch question bank:", { error });
      res.status(404).json({
        success: false,
        message: error.message || "Question bank not found",
      });
    }
  };

  public createQuestionBank = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.service.createQuestionBank(req.body);
      res.status(201).json({
        success: true,
        data,
        message: "Question bank created successfully",
      });
    } catch (error: any) {
      AppLogger.error("Failed to create question bank:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to create question bank",
      });
    }
  };

  public updateQuestionBank = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data = await this.service.updateQuestionBank(id as string, req.body);
      res.status(200).json({
        success: true,
        data,
        message: "Question bank updated successfully",
      });
    } catch (error: any) {
      AppLogger.error("Failed to update question bank:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update question bank",
      });
    }
  };

  public deleteQuestionBank = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await this.service.deleteQuestionBank(id as string);
      res.status(200).json({
        success: true,
        message: "Question bank deleted successfully",
      });
    } catch (error: any) {
      AppLogger.error("Failed to delete question bank:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete question bank",
      });
    }
  };

  public addQuestionToBank = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data = await this.service.addQuestionToBank(id as string, req.body);
      res.status(201).json({
        success: true,
        data,
        message: "Question added successfully",
      });
    } catch (error: any) {
      AppLogger.error("Failed to add question to bank:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to add question to bank",
      });
    }
  };

  public deleteQuestionFromBank = async (req: Request, res: Response): Promise<void> => {
    try {
      const { questionId } = req.params;
      await this.service.deleteQuestionFromBank(questionId as string);
      res.status(200).json({
        success: true,
        message: "Question deleted successfully",
      });
    } catch (error: any) {
      AppLogger.error("Failed to delete question from bank:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete question",
      });
    }
  };
}
