import { PrismaClient } from "../../generated/prisma";

export class OverviewService {
  constructor(private prisma: PrismaClient) { }

  /**
   * Get all dashboard content sections (clinical_topics, professional_dilemmas, daily_goal)
   */
  async getDashboardContent() {
    const sections = await this.prisma.dashboardContent.findMany({
      where: { isActive: true },
    });

    const result: Record<string, any> = {};
    for (const section of sections) {
      result[section.section] = {
        id: section.id,
        title: section.title,
        content: section.content,
        isActive: section.isActive,
      };
    }

    return result;
  }

  /**
   * Get user-specific dashboard stats computed from real attempt data
   */
  async getUserStats(userId?: string) {
    if (!userId) {
      return {
        questionsAttempted: {
          title: "QUESTIONS ATTEMPTED",
          value: "0 / 1,200",
          subtext: "No attempts yet",
          percentage: 0,
          type: "radial" as const,
        },
        accuracy: {
          title: "ACCURACY",
          value: "0 / 0",
          subtext: "0% correct",
          percentage: 0,
          type: "radial" as const,
        },
        avgTime: {
          title: "AVERAGE ANSWERING TIME",
          value: "0 sec",
          subtext: "Per attempted question",
          type: "text" as const,
        },
        weakestAreas: {
          title: "WEAKEST AREAS",
          value: "None yet",
          subtext: "0 questions to revisit",
          type: "text" as const,
        },
        weakestTopicsList: [],
      };
    }

    const filter = { userId };

    // Get mock exam attempts
    const mockAttempts = await this.prisma.mockExamAttempt.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
      include: { mockExam: true },
    });

    // Get bank attempts
    const bankAttempts = await this.prisma.bankAttempt.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
    });

    // Compute aggregate stats
    let totalQuestionsAttempted = 0;
    let totalCorrectAnswers = 0;
    let totalTimeTakenSeconds = 0;

    for (const attempt of mockAttempts) {
      totalQuestionsAttempted += attempt.totalQuestions || 0;
      totalCorrectAnswers += attempt.correctAnswers || 0;
      totalTimeTakenSeconds += attempt.timeTakenSeconds || 0;
    }

    for (const attempt of bankAttempts) {
      totalQuestionsAttempted += attempt.totalQuestions || 0;
      totalCorrectAnswers += attempt.correctAnswers || 0;
      totalTimeTakenSeconds += attempt.timeTakenSeconds || 0;
    }

    const accuracyPct = totalQuestionsAttempted > 0
      ? Math.round((totalCorrectAnswers / totalQuestionsAttempted) * 100)
      : 0;

    const avgTimePerQuestion = totalQuestionsAttempted > 0
      ? Math.round(totalTimeTakenSeconds / totalQuestionsAttempted)
      : 0;

    // Compute weakest areas from mock exams (lowest scoring categories)
    const categoryScores: Record<string, { total: number; correct: number }> = {};
    for (const attempt of mockAttempts) {
      const cat = attempt.mockExam?.category || "General";
      if (!categoryScores[cat]) {
        categoryScores[cat] = { total: 0, correct: 0 };
      }
      categoryScores[cat].total += attempt.totalQuestions || 0;
      categoryScores[cat].correct += attempt.correctAnswers || 0;
    }

    const weakestAreas = Object.entries(categoryScores)
      .map(([category, scores]) => ({
        category,
        accuracyPct: scores.total > 0 ? Math.round((scores.correct / scores.total) * 100) : 0,
        questionsToRevisit: scores.total - scores.correct,
      }))
      .filter((a) => a.accuracyPct < 60 && a.questionsToRevisit > 0)
      .sort((a, b) => a.accuracyPct - b.accuracyPct)
      .slice(0, 4);

    const weakestAreaNames = weakestAreas.length > 0
      ? weakestAreas.map((a) => a.category).join(", ")
      : "None yet";
      
    const totalToRevisit = weakestAreas.reduce((acc, a) => acc + a.questionsToRevisit, 0);
    const completedPct = totalQuestionsAttempted > 0 
      ? Math.min(100, Math.round((totalQuestionsAttempted / 1200) * 100)) 
      : 0;

    return {
      questionsAttempted: {
        title: "QUESTIONS ATTEMPTED",
        value: `${totalQuestionsAttempted.toLocaleString()} / 1,200`,
        subtext: totalQuestionsAttempted > 0 ? `${completedPct}% completed` : "No attempts yet",
        percentage: completedPct,
        type: "radial" as const,
      },
      accuracy: {
        title: "ACCURACY",
        value: `${totalCorrectAnswers.toLocaleString()} / ${totalQuestionsAttempted.toLocaleString()}`,
        subtext: `${accuracyPct}% correct`,
        percentage: accuracyPct,
        type: "radial" as const,
      },
      avgTime: {
        title: "AVERAGE ANSWERING TIME",
        value: `${avgTimePerQuestion} sec`,
        subtext: "Per attempted question",
        type: "text" as const,
      },
      weakestAreas: {
        title: "WEAKEST AREAS",
        value: weakestAreaNames,
        subtext: `${totalToRevisit} questions to revisit`,
        type: "text" as const,
      },
      weakestTopicsList: weakestAreas,
    };
  }

  /**
   * Admin: Upsert a dashboard content section
   */
  async upsertSection(section: string, payload: { title?: string; content: any; isActive?: boolean }) {
    const existing = await this.prisma.dashboardContent.findUnique({
      where: { section },
    });

    if (existing) {
      return this.prisma.dashboardContent.update({
        where: { section },
        data: {
          title: payload.title ?? existing.title,
          content: payload.content,
          isActive: payload.isActive ?? existing.isActive,
        },
      });
    }

    return this.prisma.dashboardContent.create({
      data: {
        section,
        title: payload.title,
        content: payload.content,
        isActive: payload.isActive ?? true,
      },
    });
  }

  /**
   * Admin: Delete a dashboard content section
   */
  async deleteSection(section: string) {
    const existing = await this.prisma.dashboardContent.findUnique({
      where: { section },
    });

    if (!existing) {
      throw new Error(`Dashboard section "${section}" not found`);
    }

    await this.prisma.dashboardContent.delete({
      where: { section },
    });

    return { message: `Section "${section}" deleted successfully` };
  }
}
