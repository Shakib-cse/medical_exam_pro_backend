import { PrismaClient } from "@/generated/prisma";

export class QuestionBankService {
  constructor(private prisma: PrismaClient) { }

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
            take: 1,
          }
          : false,
      },
      orderBy: { createdAt: "desc" },
    });

    return banks.map((bank) => {
      const qCount = bank.questions.length;
      const latestAttempt = bank.attempts && bank.attempts.length > 0 ? bank.attempts[0] : null;

      let avgAcc = "N/A";
      let isUnattempted = true;
      let lastAttemptedStr = undefined;

      if (latestAttempt && latestAttempt.scorePercentage !== null) {
        avgAcc = `${Math.round(latestAttempt.scorePercentage)}%`;
        isUnattempted = false;
        lastAttemptedStr = latestAttempt.completedAt
          ? new Date(latestAttempt.completedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
          : "Recently";
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
    }
  ) {
    const updated = await this.prisma.questionBank.update({
      where: { id },
      data: payload,
    });
    return updated;
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
}
