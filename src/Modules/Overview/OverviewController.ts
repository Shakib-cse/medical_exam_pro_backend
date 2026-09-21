import { Request, Response } from "express";
import { OverviewService } from "./OverviewService";
import { AppLogger } from "../../core/logging/logger";

export class OverviewController {
  constructor(private readonly service: OverviewService) { }

  private getUserId(req: Request): string | undefined {
    return req.user?.userId || (req.user as any)?.id;
  }

  /**
   * GET /api/v1/overview/content
   * Returns all admin-managed dashboard content sections
   */
  public getDashboardContent = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.service.getDashboardContent();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      AppLogger.error("Failed to fetch dashboard content:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch dashboard content",
      });
    }
  };

  /**
   * GET /api/v1/overview/stats
   * Returns user-specific computed stats from real attempt data
   */
  public getUserStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const data = await this.service.getUserStats(userId);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      AppLogger.error("Failed to fetch user stats:", { error });
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch user stats",
      });
    }
  };

  /**
   * PUT /api/v1/overview/content/:section
   * Admin: Upsert a dashboard content section
   */
  public upsertSection = async (req: Request, res: Response): Promise<void> => {
    try {
      const { section } = req.params;
      const data = await this.service.upsertSection(section as string, req.body);
      res.status(200).json({
        success: true,
        data,
        message: `Section "${section}" saved successfully`,
      });
    } catch (error: any) {
      AppLogger.error("Failed to upsert dashboard section:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to save dashboard section",
      });
    }
  };

  /**
   * DELETE /api/v1/overview/content/:section
   * Admin: Delete a dashboard content section
   */
  public deleteSection = async (req: Request, res: Response): Promise<void> => {
    try {
      const { section } = req.params;
      await this.service.deleteSection(section as string);
      res.status(200).json({
        success: true,
        message: `Section "${section}" deleted successfully`,
      });
    } catch (error: any) {
      AppLogger.error("Failed to delete dashboard section:", { error });
      res.status(400).json({
        success: false,
        message: error.message || "Failed to delete dashboard section",
      });
    }
  };

  /**
   * GET /api/v1/overview/reports
   */
  public getReports = async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.service.getQuestionReports();
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /api/v1/overview/flags
   */
  public getFlags = async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.service.getFlaggedQuestions();
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * PATCH /api/v1/overview/reports/:id/status
   */
  public updateReportStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const data = await this.service.updateReportStatus(id as string, status);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * DELETE /api/v1/overview/reports/:id
   */
  public deleteReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data = await this.service.deleteReport(id as string);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /api/v1/overview/reports
   */
  public addReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.service.addQuestionReport(req.body);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /api/v1/overview/flags
   */
  public addFlag = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.service.addFlaggedQuestion(req.body);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * DELETE /api/v1/overview/flags/:id
   */
  public deleteFlag = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data = await this.service.deleteFlaggedQuestion(id as string);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /api/v1/overview/support
   */
  public getSupportTickets = async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.service.getSupportTickets();
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /api/v1/overview/support
   */
  public createSupportTicket = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.service.addSupportTicket(req.body);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * PATCH /api/v1/overview/support/:id/status
   */
  public updateSupportTicketStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const data = await this.service.updateSupportTicketStatus(id as string, status);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * DELETE /api/v1/overview/support/:id
   */
  public deleteSupportTicket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const data = await this.service.deleteSupportTicket(id as string);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };
}
