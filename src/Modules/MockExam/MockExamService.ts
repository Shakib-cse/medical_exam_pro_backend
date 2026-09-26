import { PrismaClient } from "../../generated/prisma";
import { seedMockExams } from "../../prisma/seedMockExams";

export class MockExamService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get all active mock exams enriched with user attempt details
   */
  async getMockExams(userId?: string) {
    const mockExams = await this.prisma.mockExam.findMany({
      where: { isActive: true },
      orderBy: [{ examNumber: "asc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!userId) {
      return mockExams.map((exam, idx) => ({
        id: exam.id,
        examNumber: exam.examNumber || idx + 1,
        title: exam.title,
        description: exam.description,
        difficultyBadge: exam.difficultyBadge,
        difficultyType: exam.difficultyType,
        duration: `${exam.durationMinutes} mins`,
        durationMinutes: exam.durationMinutes,
        cpsDurationMinutes: exam.cpsDurationMinutes,
        pdDurationMinutes: exam.pdDurationMinutes,
        breakDurationMinutes: exam.breakDurationMinutes,
        questions: exam.questionCount || 147,
        cpsQuestionCount: exam.cpsQuestionCount || 97,
        pdQuestionCount: exam.pdQuestionCount || 50,
        category: exam.category,
        notAttempted: true,

        bestScore: null,
        score: 0,
        dateTaken: "Not attempted yet",
        progress: 0,
        status: "Not started",
        actionText: "Start",
      }));
    }

    // Fetch user attempts
    const attempts = await this.prisma.mockExamAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return mockExams.map((exam, idx) => {
      const examAttempts = attempts.filter((a) => a.mockExamId === exam.id);
      const completedAttempts = examAttempts.filter((a) => a.status === "COMPLETED");

      let bestScore: string | null = null;
      let scoreNum = 0;
      if (completedAttempts.length > 0) {
        scoreNum = Math.max(...completedAttempts.map((a) => a.scorePercentage || 0));
        bestScore = `${Math.round(scoreNum)}%`;
      }

      const notAttempted = examAttempts.length === 0;
      const latestAttempt = examAttempts[0];
      let status: "Completed" | "In progress" | "Not started" = "Not started";
      let actionText: "Restart" | "Resume" | "Start" = "Start";
      let progress = 0;
      let dateTaken = "Not attempted yet";

      if (latestAttempt) {
        if (latestAttempt.status === "COMPLETED") {
          status = "Completed";
          actionText = "Restart";
          progress = 100;
          if (latestAttempt.completedAt) {
            dateTaken = new Date(latestAttempt.completedAt).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
          }
        } else {
          status = "In progress";
          actionText = "Resume";
          const answeredCount = Object.keys((latestAttempt.userAnswers as object) || {}).length;
          const totalQ = exam._count.questions || exam.questionCount || 1;
          progress = Math.min(100, Math.round((answeredCount / totalQ) * 100));
        }
      }

      return {
        id: exam.id,
        examNumber: exam.examNumber || idx + 1,
        title: exam.title,
        description: exam.description,
        difficultyBadge: exam.difficultyBadge,
        difficultyType: exam.difficultyType,
        duration: `${exam.durationMinutes} mins`,
        durationMinutes: exam.durationMinutes,
        cpsDurationMinutes: exam.cpsDurationMinutes,
        pdDurationMinutes: exam.pdDurationMinutes,
        breakDurationMinutes: exam.breakDurationMinutes,
        questions: exam.questionCount || 147,
        cpsQuestionCount: exam.cpsQuestionCount || 97,
        pdQuestionCount: exam.pdQuestionCount || 50,
        category: exam.category,
        notAttempted,

        bestScore,
        score: Math.round(scoreNum),
        dateTaken,
        status,
        actionText,
        progress,
      };
    });
  }

  /**
   * Get user's exam attempt history
   */
  async getExamHistory(userId: string) {
    const attempts = await this.prisma.mockExamAttempt.findMany({
      where: { userId },
      include: {
        mockExam: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return attempts.map((attempt) => {
      const scoreNum = attempt.scorePercentage ? Math.round(attempt.scorePercentage) : 0;
      let scoreColor: "green" | "amber" | "rose" = "amber";
      if (scoreNum >= 75) scoreColor = "green";
      else if (scoreNum < 60) scoreColor = "rose";

      const dateStr = attempt.completedAt
        ? new Date(attempt.completedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : new Date(attempt.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

      const minutes = Math.floor(attempt.timeTakenSeconds / 60);
      const seconds = attempt.timeTakenSeconds % 60;
      const timeTakenStr =
        minutes > 60
          ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
          : minutes > 0
          ? `${minutes}m ${seconds}s`
          : `${seconds}s`;

      return {
        id: attempt.id,
        mockExamId: attempt.mockExamId,
        date: dateStr,
        examType: attempt.mockExam.title,
        score: attempt.status === "COMPLETED" ? `${scoreNum}%` : "In Progress",
        scoreColor,
        timeTaken: timeTakenStr,
        status: attempt.status,
      };
    });
  }

  /**
   * Get mock exam details with questions
   */
  async getMockExamById(mockExamId: string) {
    const isNum = !isNaN(Number(mockExamId));
    const mockExam = await this.prisma.mockExam.findFirst({
      where: {
        OR: [
          { id: mockExamId },
          ...(isNum ? [{ examNumber: Number(mockExamId) }] : []),
          { title: mockExamId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) },
        ],
      },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!mockExam) {
      throw new Error("Mock exam not found");
    }

    return mockExam;
  }

  /**
   * Start or resume an exam attempt
   */
  async startExamAttempt(userId: string, mockExamId: string) {
    const isNum = !isNaN(Number(mockExamId));
    const mockExam = await this.prisma.mockExam.findFirst({
      where: {
        OR: [
          { id: mockExamId },
          ...(isNum ? [{ examNumber: Number(mockExamId) }] : []),
        ],
      },
      include: { questions: true },
    });

    if (!mockExam) {
      throw new Error("Mock exam not found");
    }

    // Check for in-progress attempt
    const existing = await this.prisma.mockExamAttempt.findFirst({
      where: {
        userId,
        mockExamId: mockExam.id,
        status: "IN_PROGRESS",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return existing;
    }

    // Create new attempt
    return await this.prisma.mockExamAttempt.create({
      data: {
        userId,
        mockExamId: mockExam.id,
        totalQuestions: mockExam.questions.length || mockExam.questionCount,
        status: "IN_PROGRESS",
      },
    });
  }

  /**
   * Submit an exam attempt and calculate score across all question types (SBA, EMQ, SELECT_3, RANKING)
   */
  async submitExamAttempt(
    userId: string,
    attemptId: string,
    payload: { userAnswers: Record<string, any>; timeTakenSeconds: number }
  ) {
    const attempt = await this.prisma.mockExamAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        mockExam: {
          include: { questions: { orderBy: { order: "asc" } } },
        },
      },
    });

    if (!attempt) {
      throw new Error("Exam attempt not found");
    }

    const questions = attempt.mockExam.questions;
    let totalScoreable = 0;
    let earnedPoints = 0;

    questions.forEach((q) => {
      const qType = q.questionType;
      if (qType === "SBA") {
        totalScoreable += 1;
        const ans = payload.userAnswers[q.id];
        if (ans !== undefined) {
          if (
            ans === q.correctOption ||
            ans === q.correctAnswer ||
            (typeof ans === "string" && q.correctOption && ans.trim().toUpperCase() === q.correctOption.trim().toUpperCase())
          ) {
            earnedPoints += 1;
          }
        }
      } else if (qType === "EMQ") {
        const cases = (q.cases as any[]) || [];
        totalScoreable += cases.length || 1;
        cases.forEach((c) => {
          const caseAns = payload.userAnswers[`${q.id}_case_${c.caseNumber}`] || payload.userAnswers[`${q.id}_case_${c.id}`];
          if (caseAns && c.correctOption && caseAns.trim().toUpperCase() === c.correctOption.trim().toUpperCase()) {
            earnedPoints += 1;
          }
        });
      } else if (qType === "SELECT_3") {
        totalScoreable += 3;
        const selected = (payload.userAnswers[q.id] as string[]) || [];
        const correctList = (q.correctAnswers as string[]) || [];
        selected.forEach((letter) => {
          if (correctList.includes(letter)) {
            earnedPoints += 1;
          }
        });
      } else if (qType === "RANKING") {
        totalScoreable += 1;
        const userOrder = (payload.userAnswers[q.id] as string[]) || [];
        const ideal = (q.idealOrder as string[]) || [];
        if (ideal.length > 0 && userOrder.length === ideal.length) {
          // Check rank correlation / exact or close match
          let exactMatches = 0;
          ideal.forEach((letter, idx) => {
            if (userOrder[idx] === letter) exactMatches += 1;
          });
          if (exactMatches === ideal.length) {
            earnedPoints += 1;
          } else if (exactMatches >= 3) {
            earnedPoints += 0.6; // partial credit
          }
        }
      } else {
        totalScoreable += 1;
        if (payload.userAnswers[q.id] === q.correctAnswer) earnedPoints += 1;
      }
    });

    const total = totalScoreable || questions.length || 1;
    const scorePercentage = Math.round((earnedPoints / total) * 100);

    const updated = await this.prisma.mockExamAttempt.update({
      where: { id: attemptId },
      data: {
        status: "COMPLETED",
        scorePercentage,
        correctAnswers: Math.round(earnedPoints),
        userAnswers: payload.userAnswers,
        timeTakenSeconds: payload.timeTakenSeconds,
        completedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Admin: Create a new mock exam with optional questions
   */
  async createMockExam(payload: {
    title: string;
    description?: string;
    difficultyBadge?: string;
    difficultyType?: string;
    durationMinutes?: number;
    category?: string;
    questions?: Array<{
      questionText: string;
      options: string[];
      correctAnswer: number;
      explanation?: string;
    }>;
  }) {
    const { questions, ...examData } = payload;
    const questionList = questions || [];

    const createdExam = await this.prisma.mockExam.create({
      data: {
        title: examData.title,
        description: examData.description || null,
        difficultyBadge: examData.difficultyBadge || "MODERATE",
        difficultyType: examData.difficultyType || "moderate",
        durationMinutes: examData.durationMinutes || 45,
        questionCount: questionList.length || 10,
        category: examData.category || "General",
        questions: {
          create: questionList.map((q, idx) => ({
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || null,
            order: idx + 1,
          })),
        },
      },
      include: {
        questions: true,
      },
    });

    return createdExam;
  }

  /**
   * Admin: Update mock exam metadata and questions
   */
  async updateMockExam(
    id: string,
    payload: {
      title?: string;
      description?: string;
      difficultyBadge?: string;
      difficultyType?: string;
      durationMinutes?: number;
      category?: string;
      questions?: Array<{
        id?: string;
        questionText: string;
        options: string[];
        correctAnswer: number;
        explanation?: string;
      }>;
    }
  ) {
    const existing = await this.prisma.mockExam.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Mock exam not found");
    }

    const { questions, ...examData } = payload;

    // Update basic fields
    await this.prisma.mockExam.update({
      where: { id },
      data: {
        ...(examData.title && { title: examData.title }),
        ...(examData.description !== undefined && { description: examData.description }),
        ...(examData.difficultyBadge && { difficultyBadge: examData.difficultyBadge }),
        ...(examData.difficultyType && { difficultyType: examData.difficultyType }),
        ...(examData.durationMinutes && { durationMinutes: examData.durationMinutes }),
        ...(examData.category && { category: examData.category }),
      },
    });

    // If questions are provided, replace existing questions
    if (questions) {
      await this.prisma.mockQuestion.deleteMany({ where: { mockExamId: id } });
      await this.prisma.mockQuestion.createMany({
        data: questions.map((q, idx) => ({
          mockExamId: id,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || null,
          order: idx + 1,
        })),
      });

      await this.prisma.mockExam.update({
        where: { id },
        data: { questionCount: questions.length },
      });
    }

    return await this.getMockExamById(id);
  }

  /**
   * Admin: Delete mock exam
   */
  async deleteMockExam(id: string) {
    const existing = await this.prisma.mockExam.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Mock exam not found");
    }

    return await this.prisma.mockExam.delete({
      where: { id },
    });
  }
}
