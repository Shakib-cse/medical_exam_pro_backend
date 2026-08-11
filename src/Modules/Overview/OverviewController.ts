import { Request, Response } from "express";
import { OverviewService } from "./OverviewService";
import { AppLogger } from "@/core/logging/logger";

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
      if (!userId) {
        // Return default stats for unauthenticated users
        res.status(200).json({
          success: true,
          data: {
            questionsAttempted: { title: "QUESTIONS ATTEMPTED", value: "0", subtext: "No attempts yet", percentage: 0, type: "radial" },
            accuracy: { title: "ACCURACY", value: "0 / 0", subtext: "0% correct", percentage: 0, type: "radial" },
            avgTime: { title: "AVERAGE ANSWERING TIME", value: "0 sec", subtext: "Per attempted question", type: "text" },
            weakestAreas: { title: "WEAKEST AREAS", value: "None yet", subtext: "0 questions to revisit", type: "text" },
            weakestTopicsList: [],
          },
        });
        return;
      }

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
}
