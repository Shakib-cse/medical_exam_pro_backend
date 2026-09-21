import { PrismaClient } from "../../generated/prisma";

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

export class QuestionBankService {
  private specialtySummaryCache = new Map<string, CacheEntry<any>>();
  private specialtyFullCache = new Map<string, CacheEntry<any>>();
  private allBanksCache: CacheEntry<any> | null = null;
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(private prisma: PrismaClient) { }

  /**
   * Invalidate in-memory caches when question banks or attempts change
   */
  public clearCache(specialty?: string) {
    if (specialty) {
      const lower = specialty.toLowerCase().trim();
      const slug = lower.replace(/[^a-z0-9]+/g, "-");
      const underscore = lower.replace(/[^a-z0-9]+/g, "_");
      this.specialtySummaryCache.delete(lower);
      this.specialtySummaryCache.delete(slug);
      this.specialtySummaryCache.delete(underscore);
      this.specialtyFullCache.delete(lower);
      this.specialtyFullCache.delete(slug);
      this.specialtyFullCache.delete(underscore);
    } else {
      this.specialtySummaryCache.clear();
      this.specialtyFullCache.clear();
    }
    this.allBanksCache = null;
  }

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
   * Helper to compute exact question counts (SBA + EMQ Cases for Clinical, Ranking + Select 3 for SJT)
   */
  private computeQuestionCounts(questions: any[] = [], fallbackCount: number = 0) {
    let sbaCount = 0;
    let emqCasesCount = 0;
    let emqThemesCount = 0;
    let rankingCount = 0;
    let select3Count = 0;
    for (const q of questions) {
      if (q.questionType === "EMQ") {
        emqThemesCount++;
        if (Array.isArray(q.cases)) {
          emqCasesCount += q.cases.length;
        }
      } else if (q.questionType === "RANKING") {
        rankingCount++;
      } else if (q.questionType === "SELECT_3") {
        select3Count++;
      } else {
        sbaCount++;
      }
    }
    const isSJT = rankingCount + select3Count > 0;
    const total = isSJT
      ? rankingCount + select3Count
      : (sbaCount + emqCasesCount > 0 ? sbaCount + emqCasesCount : fallbackCount);
    return {
      questionCount: total,
      sbaCount,
      emqCount: emqCasesCount,
      emqThemesCount,
      rankingCount,
      select3Count,
    };
  }

  /**
   * Get all question bank modules
   */
  async getAllQuestionBanks(userId?: string) {
    if (!userId && this.allBanksCache && Date.now() - this.allBanksCache.cachedAt < this.CACHE_TTL_MS) {
      return this.allBanksCache.data;
    }

    const banks = await this.prisma.questionBank.findMany({
      where: { isActive: true },
      include: {
        questions: {
          select: {
            id: true,
            subTopic: true,
            questionType: true,
            cases: true,
          },
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

    const result = banks.map((bank) => {
      const counts = this.computeQuestionCounts(bank.questions, bank.questionCount || 0);
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

      const subTopics = Array.from(
        new Set(
          (bank.questions || [])
            .map((q) => q.subTopic)
            .filter((st): st is string => Boolean(st && st.trim()))
        )
      ).sort();

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
        questionCount: counts.questionCount,
        totalQuestions: counts.questionCount,
        sbaCount: counts.sbaCount,
        emqCount: counts.emqCount,
        emqThemesCount: counts.emqThemesCount,
        rankingCount: counts.rankingCount,
        select3Count: counts.select3Count,
        subTopics,
        avgAcc,
        isUnattempted,
        lastAttempted: lastAttemptedStr,
        createdAt: bank.createdAt,
      };
    });

    if (!userId) {
      this.allBanksCache = {
        data: result,
        cachedAt: Date.now(),
      };
    }

    return result;
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

    const counts = this.computeQuestionCounts(bank.questions, bank.questionCount || 0);

    const subTopics = Array.from(
      new Set(
        (bank.questions || [])
          .map((q) => q.subTopic)
          .filter((st): st is string => Boolean(st && st.trim()))
      )
    ).sort();

    const formattedQuestions = (bank.questions || []).map((q) => {
      const casesData = q.cases as any;
      return {
        ...q,
        idealOrder: casesData?.idealOrder || undefined,
        correctAnswers: casesData?.correctAnswers || undefined,
        peerStats: casesData?.peerStats || undefined,
        totalAttempts: typeof casesData?.totalAttempts === "number" ? casesData.totalAttempts : 0,
        selectionCounts: casesData?.selectionCounts || {},
        instruction: casesData?.instruction || undefined,
        references: casesData?.references || undefined,
      };
    });

    return {
      ...bank,
      ...counts,
      questions: formattedQuestions,
      subTopics,
    };
  }

  /**
   * Get question bank by specialty title or slug with distinct subtopics.
   * When summaryOnly is true, skips all heavy question texts/explanations/cases for instant load.
   */
  async getQuestionBankBySpecialty(specialtyOrSlug: string, summaryOnly: boolean = false) {
    const slugMap: Record<string, string> = {
      cardiovascular: "Cardiovascular Medicine",
      dermatology: "Dermatology",
      ent: "ENT",
      endocrinology: "Endocrinology & Diabetes",
      gastroenterology: "Gastroenterology & Hepatology",
      immunology: "Genetics & Immunology",
      haematology: "Haematology & Oncology",
      infectious: "Infectious Diseases",
      neurology: "Neurology",
      ophthalmology: "Ophthalmology",
      paediatrics: "Paediatrics",
      pharmacology: "Pharmacology",
      psychiatry: "Psychiatry",
      renal: "Renal Medicine & Urology",
      reproductive: "Reproductive Medicine",
      respiratory: "Respiratory Medicine",
      musculoskeletal: "Rheumatology & Musculoskeletal Medicine",
      surgery: "Surgery & Orthopaedics",
      "coping-with-pressure": "Coping with Pressure",
      "empathy-and-sensitivity": "Empathy & Sensitivity",
      "empathy-sensitivity": "Empathy & Sensitivity",
      "professional-integrity": "Professionalism & Integrity",
      "professionalism-and-integrity": "Professionalism & Integrity",
      "professionalism-integrity": "Professionalism & Integrity",
    };

    const normSlug = specialtyOrSlug.toLowerCase().trim();
    const targetSpecialty = slugMap[normSlug] || specialtyOrSlug;
    const targetLower = targetSpecialty.toLowerCase().trim();

    // 1. Check in-memory caches
    if (summaryOnly) {
      const cachedSummary =
        this.specialtySummaryCache.get(normSlug) ||
        this.specialtySummaryCache.get(targetLower);
      if (cachedSummary && Date.now() - cachedSummary.cachedAt < this.CACHE_TTL_MS) {
        return cachedSummary.data;
      }

      const cachedFull =
        this.specialtyFullCache.get(normSlug) ||
        this.specialtyFullCache.get(targetLower);
      if (cachedFull && Date.now() - cachedFull.cachedAt < this.CACHE_TTL_MS) {
        const { questions, ...rest } = cachedFull.data;
        const derivedSummary = {
          ...rest,
        };
        this.specialtySummaryCache.set(normSlug, { data: derivedSummary, cachedAt: Date.now() });
        this.specialtySummaryCache.set(targetLower, { data: derivedSummary, cachedAt: Date.now() });
        return derivedSummary;
      }
    } else {
      const cachedFull =
        this.specialtyFullCache.get(normSlug) ||
        this.specialtyFullCache.get(targetLower);
      if (cachedFull && Date.now() - cachedFull.cachedAt < this.CACHE_TTL_MS) {
        return cachedFull.data;
      }
    }

    // 2. Query from database
    if (summaryOnly) {
      const bank = await this.prisma.questionBank.findFirst({
        where: {
          OR: [
            { specialty: targetSpecialty },
            { title: targetSpecialty },
            { specialty: { contains: specialtyOrSlug } },
            { title: { contains: specialtyOrSlug } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          specialty: true,
          category: true,
          type: true,
          difficultyBadge: true,
          difficultyType: true,
          durationMinutes: true,
          questionCount: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          questions: {
            select: {
              id: true,
              subTopic: true,
              questionType: true,
              cases: true,
            },
            orderBy: { order: "asc" },
          },
          attempts: {
            select: {
              totalQuestions: true,
              correctAnswers: true,
              timeTakenSeconds: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!bank) {
        throw new Error(`Question bank not found for specialty: ${specialtyOrSlug}`);
      }

      const subTopics = Array.from(
        new Set(
          (bank.questions || [])
            .map((q) => q.subTopic)
            .filter((st): st is string => Boolean(st && st.trim()))
        )
      ).sort();

      const attempts = bank.attempts || [];
      let dbAttempted = 0;
      let dbCorrect = 0;
      let dbTotalTime = 0;
      for (const a of attempts) {
        dbAttempted += a.totalQuestions || 0;
        dbCorrect += a.correctAnswers || 0;
        dbTotalTime += a.timeTakenSeconds || 0;
      }
      const dbAccuracy = dbAttempted > 0 ? Math.round((dbCorrect / dbAttempted) * 100) : 0;
      const dbAvgSec = dbAttempted > 0 ? Math.round(dbTotalTime / dbAttempted) : 0;

      const subTopicCounts: Record<string, { total: number; ranking: number; select3: number; sba: number; emq: number }> = {};
      for (const q of bank.questions || []) {
        if (!q.subTopic) continue;
        const st = q.subTopic.trim();
        if (!subTopicCounts[st]) {
          subTopicCounts[st] = { total: 0, ranking: 0, select3: 0, sba: 0, emq: 0 };
        }
        if (q.questionType === "RANKING") {
          subTopicCounts[st].ranking++;
          subTopicCounts[st].total++;
        } else if (q.questionType === "SELECT_3") {
          subTopicCounts[st].select3++;
          subTopicCounts[st].total++;
        } else if (q.questionType === "EMQ") {
          const cCount = Array.isArray(q.cases) ? q.cases.length : 1;
          subTopicCounts[st].emq += cCount;
          subTopicCounts[st].total += cCount;
        } else {
          subTopicCounts[st].sba++;
          subTopicCounts[st].total++;
        }
      }

      const counts = this.computeQuestionCounts(bank.questions, bank.questionCount || 0);

      const summaryResult = {
        id: bank.id,
        title: bank.title,
        description: bank.description,
        specialty: bank.specialty,
        category: bank.category,
        type: bank.type,
        difficultyBadge: bank.difficultyBadge,
        difficultyType: bank.difficultyType,
        durationMinutes: bank.durationMinutes,
        questionCount: counts.questionCount,
        totalQuestions: counts.questionCount,
        sbaCount: counts.sbaCount,
        emqCount: counts.emqCount,
        emqThemesCount: counts.emqThemesCount,
        rankingCount: counts.rankingCount,
        select3Count: counts.select3Count,
        subTopics,
        subTopicCounts,
        stats: {
          attempted: dbAttempted,
          correct: dbCorrect,
          accuracy: dbAccuracy,
          averageTimeSeconds: dbAvgSec,
        },
        createdAt: bank.createdAt,
        updatedAt: bank.updatedAt,
      };

      const now = Date.now();
      this.specialtySummaryCache.set(normSlug, { data: summaryResult, cachedAt: now });
      this.specialtySummaryCache.set(targetLower, { data: summaryResult, cachedAt: now });

      return summaryResult;
    }

    // Full query including questions
    const bank = await this.prisma.questionBank.findFirst({
      where: {
        OR: [
          { specialty: targetSpecialty },
          { title: targetSpecialty },
          { specialty: { contains: specialtyOrSlug } },
          { title: { contains: specialtyOrSlug } },
        ],
      },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        attempts: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!bank) {
      throw new Error(`Question bank not found for specialty: ${specialtyOrSlug}`);
    }

    const subTopics = Array.from(
      new Set(
        (bank.questions || [])
          .map((q) => q.subTopic)
          .filter((st): st is string => Boolean(st && st.trim()))
      )
    ).sort();

    const attempts = bank.attempts || [];
    let dbAttempted = 0;
    let dbCorrect = 0;
    let dbTotalTime = 0;
    for (const a of attempts) {
      dbAttempted += a.totalQuestions || 0;
      dbCorrect += a.correctAnswers || 0;
      dbTotalTime += a.timeTakenSeconds || 0;
    }
    const dbAccuracy = dbAttempted > 0 ? Math.round((dbCorrect / dbAttempted) * 100) : 0;
    const dbAvgSec = dbAttempted > 0 ? Math.round(dbTotalTime / dbAttempted) : 0;

    const counts = this.computeQuestionCounts(bank.questions, bank.questionCount || 0);

    const subTopicCounts: Record<string, { total: number; ranking: number; select3: number; sba: number; emq: number }> = {};
    for (const q of bank.questions || []) {
      if (!q.subTopic) continue;
      const st = q.subTopic.trim();
      if (!subTopicCounts[st]) {
        subTopicCounts[st] = { total: 0, ranking: 0, select3: 0, sba: 0, emq: 0 };
      }
      if (q.questionType === "RANKING") {
        subTopicCounts[st].ranking++;
        subTopicCounts[st].total++;
      } else if (q.questionType === "SELECT_3") {
        subTopicCounts[st].select3++;
        subTopicCounts[st].total++;
      } else if (q.questionType === "EMQ") {
        const cCount = Array.isArray(q.cases) ? q.cases.length : 1;
        subTopicCounts[st].emq += cCount;
        subTopicCounts[st].total += cCount;
      } else {
        subTopicCounts[st].sba++;
        subTopicCounts[st].total++;
      }
    }

    const formattedQuestions = (bank.questions || []).map((q) => {
      const casesData = q.cases as any;
      return {
        ...q,
        idealOrder: casesData?.idealOrder || undefined,
        correctAnswers: casesData?.correctAnswers || undefined,
        peerStats: casesData?.peerStats || undefined,
        totalAttempts: typeof casesData?.totalAttempts === "number" ? casesData.totalAttempts : 0,
        selectionCounts: casesData?.selectionCounts || {},
        instruction: casesData?.instruction || undefined,
        references: casesData?.references || undefined,
      };
    });

    const fullResult = {
      ...bank,
      ...counts,
      totalQuestions: counts.questionCount,
      questions: formattedQuestions,
      subTopics,
      subTopicCounts,
      stats: {
        attempted: dbAttempted,
        correct: dbCorrect,
        accuracy: dbAccuracy,
        averageTimeSeconds: dbAvgSec,
      },
    };

    const now = Date.now();
    this.specialtyFullCache.set(normSlug, { data: fullResult, cachedAt: now });
    this.specialtyFullCache.set(targetLower, { data: fullResult, cachedAt: now });

    const { questions, ...rest } = fullResult;
    const summaryData = {
      ...rest,
    };
    this.specialtySummaryCache.set(normSlug, { data: summaryData, cachedAt: now });
    this.specialtySummaryCache.set(targetLower, { data: summaryData, cachedAt: now });

    return fullResult;
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
          include: {
            questions: {
              select: { id: true, correctAnswer: true },
            },
          },
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
      include: {
        questionBank: {
          select: { specialty: true, title: true },
        },
      },
    });

    if (updated?.questionBank?.specialty) {
      this.clearCache(updated.questionBank.specialty);
    }
    if (updated?.questionBank?.title) {
      this.clearCache(updated.questionBank.title);
    }

    return updated;
  }

  /**
   * Record a candidate's answer for a question and dynamically recalculate peer selection percentages.
   */
  async recordQuestionAnswer(
    questionId: string,
    payload: {
      selectedOptions?: string[]; // e.g. ["A", "C", "F"]
      rankOrder?: string[];       // e.g. ["B", "D", "A", "C", "E"]
      userId?: string;
    }
  ) {
    const question = await this.prisma.bankQuestion.findUnique({
      where: { id: questionId },
      include: {
        questionBank: {
          select: { id: true, specialty: true, type: true },
        },
      },
    });

    if (!question) {
      throw new Error(`Question ${questionId} not found`);
    }

    const casesData = ((question.cases as any) || {}) as Record<string, any>;
    const selectedOptions = (payload.selectedOptions || []).map((o) => String(o).toUpperCase().trim());

    // Extract valid option letter keys from question.options
    const rawOptions = (Array.isArray(question.options) ? question.options : []) as string[];
    const parsedLetters = rawOptions
      .map((opt) => {
        const match = String(opt).match(/^([A-Za-z])/);
        return match ? match[1].toUpperCase() : "";
      })
      .filter(Boolean);

    const optionKeys =
      parsedLetters.length > 0
        ? parsedLetters
        : ["A", "B", "C", "D", "E", "F", "G", "H"].slice(0, rawOptions.length || 8);

    // Real dynamic calculation: start from actual recorded user submissions
    let totalAttempts = typeof casesData.totalAttempts === "number" ? casesData.totalAttempts : 0;
    let selectionCounts: Record<string, number> = { ...(casesData.selectionCounts || {}) };

    // Increment total attempts by 1
    totalAttempts += 1;

    // Increment counts for each option selected by the user
    for (const opt of selectedOptions) {
      if (optionKeys.includes(opt) || /^[A-Z]$/.test(opt)) {
        selectionCounts[opt] = (selectionCounts[opt] || 0) + 1;
      }
    }

    // Recalculate dynamic peer percentages (0 - 100%)
    const updatedPeerStats: Record<string, number> = {};
    for (const key of optionKeys) {
      const count = selectionCounts[key] || 0;
      updatedPeerStats[key] = Math.min(100, Math.max(0, Math.round((count / totalAttempts) * 100)));
    }

    const updatedCases = {
      ...casesData,
      peerStats: updatedPeerStats,
      selectionCounts,
      totalAttempts,
    };

    // Persist to MariaDB
    await this.prisma.bankQuestion.update({
      where: { id: questionId },
      data: {
        cases: updatedCases,
      },
    });

    // Invalidate specialty cache so subsequent fetches get fresh peer stats
    if (question.questionBank?.specialty) {
      this.clearCache(question.questionBank.specialty);
    }

    return {
      questionId,
      peerStats: updatedPeerStats,
      totalAttempts,
      selectionCounts,
      userSelections: selectedOptions,
    };
  }
}

