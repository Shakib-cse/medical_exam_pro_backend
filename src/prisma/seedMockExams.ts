import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

export async function seedMockExams() {
  const jsonPath = path.join(__dirname, "../../data/mock_exams_all.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("mock_exams_all.json not found at", jsonPath);
    return;
  }

  const allMocks = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`Starting seed for all ${allMocks.length} full-length Mock Exams...`);

  let totalSeededQuestions = 0;

  for (const mockData of allMocks) {
    const {
      examNumber,
      title,
      description,
      difficultyBadge,
      difficultyType,
      durationMinutes,
      cpsDurationMinutes,
      pdDurationMinutes,
      breakDurationMinutes,
      questionCount,
      cpsQuestionCount,
      pdQuestionCount,
      category,
      questions,
    } = mockData;

    console.log(`\n========================================`);
    console.log(`Seeding ${title} (Exam #${examNumber}, ${questions.length} items)...`);

    // 1. Find existing mock exam or create
    let exam = await prisma.mockExam.findFirst({
      where: {
        OR: [
          { examNumber: examNumber },
          { title: title },
        ],
      },
    });

    if (!exam) {
      exam = await prisma.mockExam.create({
        data: {
          title,
          examNumber,
          description,
          difficultyBadge,
          difficultyType,
          durationMinutes: durationMinutes || 120,
          cpsDurationMinutes: cpsDurationMinutes || 75,
          pdDurationMinutes: pdDurationMinutes || 45,
          breakDurationMinutes: breakDurationMinutes || 5,
          questionCount: questionCount || 136,
          cpsQuestionCount: cpsQuestionCount || 86,
          pdQuestionCount: pdQuestionCount || 50,
          category: category || "MSRA Mock",
          isActive: true,
        },
      });
      console.log(`Created new MockExam: ${exam.title} (${exam.id})`);
    } else {
      exam = await prisma.mockExam.update({
        where: { id: exam.id },
        data: {
          title,
          examNumber,
          description,
          difficultyBadge,
          difficultyType,
          durationMinutes: durationMinutes || 120,
          cpsDurationMinutes: cpsDurationMinutes || 75,
          pdDurationMinutes: pdDurationMinutes || 45,
          breakDurationMinutes: breakDurationMinutes || 5,
          questionCount: questionCount || 136,
          cpsQuestionCount: cpsQuestionCount || 86,
          pdQuestionCount: pdQuestionCount || 50,
          category: category || "MSRA Mock",
          isActive: true,
        },
      });
      console.log(`Updated MockExam: ${exam.title} (${exam.id})`);
    }

    // 2. Remove existing questions for a clean seed
    await prisma.mockQuestion.deleteMany({
      where: { mockExamId: exam.id },
    });

    // 3. Prepare questions data
    const questionsToInsert = questions.map((q: any, idx: number) => ({
      mockExamId: exam.id,
      section: q.section || "CPS",
      questionType: q.questionType || "SBA",
      questionText: q.questionText || q.vignette || "Question",
      vignette: q.vignette || q.questionText || "",
      options: q.options || [],
      optionsDict: q.optionsDict || null,
      correctAnswer: q.correctAnswer ?? 0,
      correctOption: q.correctOption || null,
      correctAnswers: q.correctAnswers || null,
      idealOrder: q.idealOrder || null,
      explanation: q.explanation || "",
      references: q.references || "",
      themeNumber: q.themeNumber || null,
      themeTitle: q.themeTitle || null,
      cases: q.cases || null,
      subTopic: q.subTopic || null,
      order: q.order || idx + 1,
    }));

    // 4. Batch insert in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < questionsToInsert.length; i += chunkSize) {
      const chunk = questionsToInsert.slice(i, i + chunkSize);
      await prisma.mockQuestion.createMany({
        data: chunk,
      });
    }

    totalSeededQuestions += questionsToInsert.length;
    console.log(`Successfully seeded ${questionsToInsert.length} questions for ${title}`);
  }

  // Remove any legacy mock exams that are not 1-10
  const legacyMocks = await prisma.mockExam.findMany({
    where: {
      examNumber: null,
    },
  });
  if (legacyMocks.length > 0) {
    console.log(`Cleaning up ${legacyMocks.length} old placeholder mock exams...`);
    for (const legacy of legacyMocks) {
      await prisma.mockQuestion.deleteMany({ where: { mockExamId: legacy.id } });
      await prisma.mockExam.delete({ where: { id: legacy.id } });
    }
  }

  console.log(`\n========================================`);
  console.log(`MOCK EXAMS SEED COMPLETE!`);
  console.log(`Total Mock Exams: ${allMocks.length}`);
  console.log(`Total Mock Questions seeded: ${totalSeededQuestions}`);
}

// Allow standalone execution: bun run src/prisma/seedMockExams.ts
if (import.meta.main || process.argv[1]?.endsWith("seedMockExams.ts")) {
  seedMockExams()
    .then(() => {
      console.log("Mock exam seeding script finished.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error seeding mock exams:", err);
      process.exit(1);
    });
}
