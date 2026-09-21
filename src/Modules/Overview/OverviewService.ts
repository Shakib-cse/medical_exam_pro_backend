import { PrismaClient } from "../../generated/prisma";

export class OverviewService {
  private cachedClinicalTopics: any = null;
  private cachedProfessionalDilemmas: any = null;

  constructor(private prisma: PrismaClient) { }

  /**
   * Invalidate in-memory caches
   */
  public clearCache() {
    this.cachedClinicalTopics = null;
    this.cachedProfessionalDilemmas = null;
  }

  /**
   * Get all dashboard content sections (clinical_topics, professional_dilemmas, daily_goal, question_reports, flagged_questions)
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

    // Dynamic synthesis for clinical_topics if not stored or empty
    if (!result.clinical_topics || !Array.isArray(result.clinical_topics.content) || result.clinical_topics.content.length === 0) {
      if (this.cachedClinicalTopics) {
        result.clinical_topics = this.cachedClinicalTopics;
      } else {
        const banks = await this.prisma.questionBank.findMany({
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            specialty: true,
            questionCount: true,
          },
          orderBy: { specialty: "asc" },
        });

        if (banks.length > 0) {
          const topics = banks.map((bank) => {
            const totalQ = bank.questionCount || 0;
            const sbaCount = Math.ceil(totalQ / 2);
            const emqCount = Math.floor(totalQ / 2);

            return {
              id: bank.id,
              title: bank.title,
              specialty: bank.specialty,
              image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&auto=format&fit=crop&q=80",
              totalQ,
              sbaCount,
              emqCount,
              category: "all",
            };
          });

          result.clinical_topics = {
            id: "dynamic_clinical_topics",
            title: "Clinical Problem Solving",
            content: topics,
            isActive: true,
          };
          this.cachedClinicalTopics = result.clinical_topics;
        }
      }
    }

    // Dynamic synthesis for professional_dilemmas if not stored or empty
    if (
      !result.professional_dilemmas ||
      !result.professional_dilemmas.content ||
      !Array.isArray(result.professional_dilemmas.content) ||
      result.professional_dilemmas.content.length === 0
    ) {
      if (this.cachedProfessionalDilemmas) {
        result.professional_dilemmas = this.cachedProfessionalDilemmas;
      } else {
        const DOMAIN_IMAGE_MAP: Record<string, string> = {
          "coping-with-pressure": "/images/dilemmas/coping-with-pressure.jpg",
          "empathy-and-sensitivity": "/images/dilemmas/empathy-and-sensitivity.jpg",
          "empathy-sensitivity": "/images/dilemmas/empathy-and-sensitivity.jpg",
          "professionalism-and-integrity": "/images/dilemmas/professional-integrity.jpg",
          "professionalism-integrity": "/images/dilemmas/professional-integrity.jpg",
          "professional-integrity": "/images/dilemmas/professional-integrity.jpg",
        };

        const sjtBanks = await this.prisma.questionBank.findMany({
          where: { type: "SJT", isActive: true },
          select: {
            id: true,
            title: true,
            description: true,
            questionCount: true,
          },
          orderBy: { title: "asc" },
        });

        if (sjtBanks.length > 0) {
          const cards = sjtBanks.map((bank) => {
            const slug = bank.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const totalQ = bank.questionCount || 0;
            const rankingCount = Math.ceil(totalQ / 2);
            const select3Count = Math.floor(totalQ / 2);

            return {
              id: bank.id,
              title: bank.title,
              subtitle: bank.description || `Practice ${bank.title} questions`,
              image: DOMAIN_IMAGE_MAP[slug] || `/images/dilemmas/${slug}.jpg`,
              totalQ,
              rankingCount,
              select3Count,
              topics: [],
            };
          });

          result.professional_dilemmas = {
            id: "dynamic_professional_dilemmas",
            title: "Professional Dilemmas",
            content: cards,
            isActive: true,
          };
          this.cachedProfessionalDilemmas = result.professional_dilemmas;
        }
      }
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
    if (section === "clinical_topics") this.cachedClinicalTopics = null;
    if (section === "professional_dilemmas") this.cachedProfessionalDilemmas = null;

    const existing = await this.prisma.dashboardContent.findUnique({
      where: { section },
    });

    // Intelligent merge for arrays in flagged_questions and question_reports so entries are preserved
    if (
      (section === "flagged_questions" || section === "question_reports") &&
      Array.isArray(payload.content) &&
      existing?.content &&
      Array.isArray(existing.content)
    ) {
      const mergedMap = new Map((existing.content as any[]).map((item) => [item.id, item]));
      for (const item of payload.content) {
        if (item.id) {
          mergedMap.set(item.id, { ...(mergedMap.get(item.id) || {}), ...item });
        }
      }
      payload.content = Array.from(mergedMap.values());
    }

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
   * Dedicated: Get candidate question reports
   */
  async getQuestionReports() {
    const record = await this.prisma.dashboardContent.findUnique({
      where: { section: "question_reports" },
    });
    return (record?.content as any[]) || [];
  }

  /**
   * Dedicated: Add or update a single question report
   */
  async addQuestionReport(report: any) {
    const reports = await this.getQuestionReports();
    const repId = report.id || `rep-${Date.now()}`;
    const idx = reports.findIndex(
      (r: any) => r.id === repId || (r.questionId === report.questionId && r.userId === report.userId)
    );
    let updated: any[];
    if (idx >= 0) {
      updated = [...reports];
      updated[idx] = { ...updated[idx], ...report, id: reports[idx].id };
    } else {
      updated = [{ ...report, id: repId }, ...reports];
    }
    await this.prisma.dashboardContent.upsert({
      where: { section: "question_reports" },
      update: { content: updated },
      create: { section: "question_reports", title: "Question Reports", content: updated, isActive: true },
    });
    return updated;
  }

  /**
   * Dedicated: Get candidate flagged questions
   */
  async getFlaggedQuestions() {
    const record = await this.prisma.dashboardContent.findUnique({
      where: { section: "flagged_questions" },
    });
    return (record?.content as any[]) || [];
  }

  /**
   * Dedicated: Add or update a single flagged question
   */
  async addFlaggedQuestion(flag: any) {
    const flags = await this.getFlaggedQuestions();
    const flagId = flag.id;
    const exists = flags.some((f: any) => f.id === flagId || (f.prompt && flag.prompt && f.prompt === flag.prompt));
    let updated: any[];
    if (!exists) {
      updated = [flag, ...flags];
    } else {
      updated = flags.map((f: any) =>
        f.id === flagId || (f.prompt && flag.prompt && f.prompt === flag.prompt) ? { ...f, ...flag } : f
      );
    }
    await this.prisma.dashboardContent.upsert({
      where: { section: "flagged_questions" },
      update: { content: updated },
      create: { section: "flagged_questions", title: "Flagged Questions", content: updated, isActive: true },
    });
    return updated;
  }

  /**
   * Dedicated: Update a question report's status
   */
  async updateReportStatus(reportId: string, status: string) {
    const reports = await this.getQuestionReports();
    const updated = reports.map((r: any) => (r.id === reportId ? { ...r, status } : r));
    await this.prisma.dashboardContent.upsert({
      where: { section: "question_reports" },
      update: { content: updated },
      create: { section: "question_reports", title: "Question Reports", content: updated, isActive: true },
    });
    return updated;
  }

  /**
   * Dedicated: Delete a question report
   */
  async deleteReport(reportId: string) {
    const reports = await this.getQuestionReports();
    const updated = reports.filter((r: any) => r.id !== reportId);
    await this.prisma.dashboardContent.upsert({
      where: { section: "question_reports" },
      update: { content: updated },
      create: { section: "question_reports", title: "Question Reports", content: updated, isActive: true },
    });
    return updated;
  }

  /**
   * Dedicated: Delete a flagged question
   */
  async deleteFlaggedQuestion(flagId: string) {
    const flags = await this.getFlaggedQuestions();
    const updated = flags.filter((f: any) => f.id !== flagId);
    await this.prisma.dashboardContent.upsert({
      where: { section: "flagged_questions" },
      update: { content: updated },
      create: { section: "flagged_questions", title: "Flagged Questions", content: updated, isActive: true },
    });
    return updated;
  }

  /**
   * Dedicated: Get candidate support inquiries / tickets
   */
  async getSupportTickets() {
    const record = await this.prisma.dashboardContent.findUnique({
      where: { section: "support_tickets" },
    });
    return (record?.content as any[]) || [];
  }

  /**
   * Dedicated: Add a new candidate support ticket
   */
  async addSupportTicket(ticket: any) {
    const tickets = await this.getSupportTickets();
    const newTicket = {
      id: ticket.id || `ticket-${Date.now()}`,
      subject: ticket.subject || "General Support",
      email: ticket.email || "",
      description: ticket.description || "",
      userName: ticket.userName || "Candidate",
      userId: ticket.userId || "",
      status: ticket.status || "open", // "open" | "in_progress" | "resolved"
      createdAt: ticket.createdAt || new Date().toLocaleString(),
    };
    const updated = [newTicket, ...tickets];
    await this.prisma.dashboardContent.upsert({
      where: { section: "support_tickets" },
      update: { content: updated },
      create: { section: "support_tickets", title: "Support Tickets", content: updated, isActive: true },
    });
    return updated;
  }

  /**
   * Dedicated: Update support ticket status
   */
  async updateSupportTicketStatus(ticketId: string, status: string) {
    const tickets = await this.getSupportTickets();
    const updated = tickets.map((t: any) => (t.id === ticketId ? { ...t, status } : t));
    await this.prisma.dashboardContent.upsert({
      where: { section: "support_tickets" },
      update: { content: updated },
      create: { section: "support_tickets", title: "Support Tickets", content: updated, isActive: true },
    });
    return updated;
  }

  /**
   * Dedicated: Delete support ticket
   */
  async deleteSupportTicket(ticketId: string) {
    const tickets = await this.getSupportTickets();
    const updated = tickets.filter((t: any) => t.id !== ticketId);
    await this.prisma.dashboardContent.upsert({
      where: { section: "support_tickets" },
      update: { content: updated },
      create: { section: "support_tickets", title: "Support Tickets", content: updated, isActive: true },
    });
    return updated;
  }

  /**
   * Admin: Delete a dashboard content section
   */
  async deleteSection(section: string) {
    if (section === "clinical_topics") this.cachedClinicalTopics = null;
    if (section === "professional_dilemmas") this.cachedProfessionalDilemmas = null;

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
