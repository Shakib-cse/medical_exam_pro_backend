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
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!userId) {
      return mockExams.map((exam) => ({
        id: exam.id,
        title: exam.title,
        description: exam.description,
        difficultyBadge: exam.difficultyBadge,
        difficultyType: exam.difficultyType,
        duration: `${exam.durationMinutes} mins`,
        durationMinutes: exam.durationMinutes,
        questions: exam._count.questions || exam.questionCount,
        category: exam.category,
        notAttempted: true,
        bestScore: null,
        progress: 0,
        status: "Not started",
        actionText: "Start",
      }));
    }

    // Fetch user attempts
    const attempts = userId
      ? await this.prisma.mockExamAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      })
      : [];

    return mockExams.map((exam) => {
      const examAttempts = attempts.filter((a) => a.mockExamId === exam.id);
      const completedAttempts = examAttempts.filter((a) => a.status === "COMPLETED");

      let bestScore: string | null = null;
      if (completedAttempts.length > 0) {
        const maxScore = Math.max(...completedAttempts.map((a) => a.scorePercentage || 0));
        bestScore = `${Math.round(maxScore)}%`;
      }

      const notAttempted = examAttempts.length === 0;

      const latestAttempt = examAttempts[0];
      let status: "Completed" | "In progress" | "Not started" = "Not started";
      let actionText: "Restart" | "Resume" | "Start" = "Start";
      let progress = 0;

      if (latestAttempt) {
        if (latestAttempt.status === "COMPLETED") {
          status = "Completed";
          actionText = "Restart";
          progress = 100;
        } else {
          status = "In progress";
          actionText = "Resume";
          const answeredCount = Object.keys(latestAttempt.userAnswers as object || {}).length;
          const totalQ = exam._count.questions || exam.questionCount || 1;
          progress = Math.min(100, Math.round((answeredCount / totalQ) * 100));
        }
      }

      return {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        difficultyBadge: exam.difficultyBadge,
        difficultyType: exam.difficultyType,
        duration: `${exam.durationMinutes} mins`,
        durationMinutes: exam.durationMinutes,
        questions: exam._count.questions || exam.questionCount,
        category: exam.category,
        notAttempted,
        bestScore,
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
    const mockExam = await this.prisma.mockExam.findUnique({
      where: { id: mockExamId },
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
    const mockExam = await this.prisma.mockExam.findUnique({
      where: { id: mockExamId },
      include: { questions: true },
    });

    if (!mockExam) {
      throw new Error("Mock exam not found");
    }

    // Check for in-progress attempt
    const existing = await this.prisma.mockExamAttempt.findFirst({
      where: {
        userId,
        mockExamId,
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
        mockExamId,
        totalQuestions: mockExam.questions.length || mockExam.questionCount,
        status: "IN_PROGRESS",
      },
    });
  }

  /**
   * Submit an exam attempt and calculate score
   */
  async submitExamAttempt(
    userId: string,
    attemptId: string,
    payload: { userAnswers: Record<string, number>; timeTakenSeconds: number }
  ) {
    const attempt = await this.prisma.mockExamAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        mockExam: {
          include: { questions: true },
        },
      },
    });

    if (!attempt) {
      throw new Error("Exam attempt not found");
    }

    const questions = attempt.mockExam.questions;
    let correctCount = 0;

    questions.forEach((q) => {
      const userChoice = payload.userAnswers[q.id];
      if (userChoice !== undefined && userChoice === q.correctAnswer) {
        correctCount += 1;
      }
    });

    const total = questions.length || 1;
    const scorePercentage = (correctCount / total) * 100;

    const updated = await this.prisma.mockExamAttempt.update({
      where: { id: attemptId },
      data: {
        status: "COMPLETED",
        scorePercentage,
        correctAnswers: correctCount,
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
