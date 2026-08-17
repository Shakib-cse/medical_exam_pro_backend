import { PrismaClient } from "../../generated/prisma";

export class QuestionBankService {
  constructor(private prisma: PrismaClient) { }

  /**
   * Helper to format attempt date into relative string ("Today", "1 day ago", "X days ago")
   */
  private formatDaysAgo(dateInput: Date | string): string {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "Recently";

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const attemptMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

    const diffMs = todayMidnight - attemptMidnight;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "1 day ago";
    } else {
      return `${diffDays} days ago`;
    }
  }

  /**
   * Get all question bank modules
   */
  async getAllQuestionBanks(userId?: string) {
    const banks = await this.prisma.questionBank.findMany({
      where: { isActive: true },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        attempts: userId
          ? {
            where: { userId },
            orderBy: { createdAt: "desc" },
          }
          : false,
      },
      orderBy: { createdAt: "desc" },
    });

    return banks.map((bank) => {
      const qCount = bank.questions && bank.questions.length > 0 ? bank.questions.length : (bank.questionCount || 0);
      const bankAttempts = bank.attempts || [];
      const completedAttempts = bankAttempts.filter((a) => a.status === "COMPLETED");
      const latestCompleted = completedAttempts.length > 0 ? completedAttempts[0] : null;

      let avgAcc = "N/A";
      let isUnattempted = true;
      let lastAttemptedStr = undefined;

      if (latestCompleted) {
        if (latestCompleted.scorePercentage !== null && latestCompleted.scorePercentage !== undefined) {
          avgAcc = `${Math.round(latestCompleted.scorePercentage)}%`;
        }
        isUnattempted = false;
        const attemptDate = latestCompleted.completedAt || latestCompleted.createdAt;
        if (attemptDate) {
          lastAttemptedStr = this.formatDaysAgo(attemptDate);
        }
      }

      return {
        id: bank.id,
        title: bank.title,
        description: bank.description,
        specialty: bank.specialty,
        category: bank.category,
        type: bank.type,
        difficultyBadge: bank.difficultyBadge,
        difficultyType: bank.difficultyType,
        durationMinutes: bank.durationMinutes,
        questionCount: qCount,
        questions: bank.questions,
        avgAcc,
        isUnattempted,
        lastAttempted: lastAttemptedStr,
        createdAt: bank.createdAt,
      };
    });
  }

  /**
   * Get single question bank by ID
   */
  async getQuestionBankById(id: string) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!bank) {
      throw new Error("Question Bank module not found");
    }

    return bank;
  }

  /**
   * Admin: Create a new question bank module
   */
  async createQuestionBank(payload: {
    title: string;
    description?: string;
    specialty?: string;
    category?: string;
    type?: string;
    difficultyBadge?: string;
    difficultyType?: string;
    durationMinutes?: number;
    questions?: Array<{
      questionText: string;
      options: string[];
      correctAnswer: number;
      explanation?: string;
      subTopic?: string;
    }>;
  }) {
    const createdBank = await this.prisma.questionBank.create({
      data: {
        title: payload.title,
        description: payload.description,
        specialty: payload.specialty || "General Medicine",
        category: payload.category || "Clinical Practice",
        type: payload.type || "Clinical",
        difficultyBadge: payload.difficultyBadge || "MODERATE",
        difficultyType: payload.difficultyType || "moderate",
        durationMinutes: payload.durationMinutes || 0,
        questionCount: payload.questions ? payload.questions.length : 0,
        questions: payload.questions
          ? {
            create: payload.questions.map((q, index) => ({
              questionText: q.questionText,
              options: q.options,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              subTopic: q.subTopic,
              order: index,
            })),
          }
          : undefined,
      },
      include: {
        questions: true,
      },
    });

    return createdBank;
  }

  /**
   * Admin: Update question bank
   */
  async updateQuestionBank(
    id: string,
    payload: {
      title?: string;
      description?: string;
      specialty?: string;
      category?: string;
      type?: string;
      difficultyBadge?: string;
      difficultyType?: string;
      durationMinutes?: number;
      questions?: Array<{
        id?: string;
        questionText: string;
        options: string[];
        correctAnswer: number;
        explanation?: string;
        subTopic?: string;
      }>;
    }
  ) {
    const existing = await this.prisma.questionBank.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Question Bank module not found");
    }

    const { questions, ...bankData } = payload;

    await this.prisma.questionBank.update({
      where: { id },
      data: {
        ...(bankData.title !== undefined && { title: bankData.title }),
        ...(bankData.description !== undefined && { description: bankData.description }),
        ...(bankData.specialty !== undefined && { specialty: bankData.specialty }),
        ...(bankData.category !== undefined && { category: bankData.category }),
        ...(bankData.type !== undefined && { type: bankData.type }),
        ...(bankData.difficultyBadge !== undefined && { difficultyBadge: bankData.difficultyBadge }),
        ...(bankData.difficultyType !== undefined && { difficultyType: bankData.difficultyType }),
        ...(bankData.durationMinutes !== undefined && { durationMinutes: bankData.durationMinutes }),
      },
    });

    if (questions) {
      await this.prisma.bankQuestion.deleteMany({ where: { questionBankId: id } });
      if (questions.length > 0) {
        await this.prisma.bankQuestion.createMany({
          data: questions.map((q, idx) => ({
            questionBankId: id,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || null,
            subTopic: q.subTopic || null,
            order: idx,
          })),
        });
      }

      await this.prisma.questionBank.update({
        where: { id },
        data: { questionCount: questions.length },
      });
    }

    return await this.getQuestionBankById(id);
  }

  /**
   * Admin: Delete question bank
   */
  async deleteQuestionBank(id: string) {
    await this.prisma.questionBank.delete({
      where: { id },
    });
    return { message: "Question bank deleted successfully" };
  }

  /**
   * Admin: Add question to bank
   */
  async addQuestionToBank(
    questionBankId: string,
    payload: {
      questionText: string;
      options: string[];
      correctAnswer: number;
      explanation?: string;
      subTopic?: string;
    }
  ) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: { questions: true },
    });

    if (!bank) {
      throw new Error("Question Bank module not found");
    }

    const newQuestion = await this.prisma.bankQuestion.create({
      data: {
        questionBankId,
        questionText: payload.questionText,
        options: payload.options,
        correctAnswer: payload.correctAnswer,
        explanation: payload.explanation,
        subTopic: payload.subTopic,
        order: bank.questions.length,
      },
    });

    await this.prisma.questionBank.update({
      where: { id: questionBankId },
      data: { questionCount: bank.questions.length + 1 },
    });

    return newQuestion;
  }

  /**
   * Admin: Delete question from bank
   */
  async deleteQuestionFromBank(questionId: string) {
    const q = await this.prisma.bankQuestion.findUnique({
      where: { id: questionId },
    });

    if (!q) {
      throw new Error("Question not found");
    }

    await this.prisma.bankQuestion.delete({
      where: { id: questionId },
    });

    const remainingCount = await this.prisma.bankQuestion.count({
      where: { questionBankId: q.questionBankId },
    });

    await this.prisma.questionBank.update({
      where: { id: q.questionBankId },
      data: { questionCount: remainingCount },
    });

    return { message: "Question deleted successfully" };
  }

  /**
   * Start a new bank attempt or resume in-progress attempt
   */
  async startBankAttempt(userId: string, bankId: string) {
    const bank = await this.prisma.questionBank.findUnique({
      where: { id: bankId },
      include: { questions: true },
    });

    if (!bank) {
      throw new Error("Question Bank module not found");
    }

    const existing = await this.prisma.bankAttempt.findFirst({
      where: {
        userId,
        questionBankId: bankId,
        status: "IN_PROGRESS",
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return existing;
    }

    return await this.prisma.bankAttempt.create({
      data: {
        userId,
        questionBankId: bankId,
        totalQuestions: bank.questions.length || bank.questionCount,
        status: "IN_PROGRESS",
      },
    });
  }

  /**
   * Submit a bank attempt and calculate score
   */
  async submitBankAttempt(
    userId: string,
    attemptId: string,
    payload: { userAnswers: Record<string, number>; timeTakenSeconds: number }
  ) {
    const attempt = await this.prisma.bankAttempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        questionBank: {
          include: { questions: true },
        },
      },
    });

    if (!attempt) {
      throw new Error("Bank attempt not found");
    }

    const questions = attempt.questionBank.questions;
    let correctCount = 0;

    questions.forEach((q) => {
      const userChoice = payload.userAnswers[q.id];
      if (userChoice !== undefined && userChoice === q.correctAnswer) {
        correctCount += 1;
      }
    });

    const total = questions.length || 1;
    const scorePercentage = (correctCount / total) * 100;

    const updated = await this.prisma.bankAttempt.update({
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
}

