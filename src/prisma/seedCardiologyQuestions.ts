import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

export async function seedCardiologyQuestions() {
  const jsonPath = path.join(__dirname, "../../data/cardiology.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("cardiology.json not found at", jsonPath);
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const { specialty, sba, emq } = rawData;

  console.log(`Starting import for ${specialty}...`);
  console.log(`Found ${sba.length} SBA questions and ${emq.length} EMQ themes.`);

  // 1. Find or create QuestionBank for Cardiovascular Medicine
  let bank = await prisma.questionBank.findFirst({
    where: { specialty: "Cardiovascular Medicine" },
  });

  if (!bank) {
    bank = await prisma.questionBank.create({
      data: {
        title: "Cardiovascular Medicine",
        specialty: "Cardiovascular Medicine",
        category: "Clinical Practice",
        type: "Clinical",
        description: "Official CPS Cardiovascular Medicine Question Bank containing SBA and EMQ questions.",
        difficultyBadge: "CLINICAL",
        difficultyType: "clinical",
        durationMinutes: 45,
        questionCount: sba.length + emq.length,
        isActive: true,
      },
    });
    console.log(`Created new QuestionBank: ${bank.title} (${bank.id})`);
  } else {
    console.log(`Using existing QuestionBank: ${bank.title} (${bank.id})`);
  }

  // Clear existing questions for clean seed
  const deleted = await prisma.bankQuestion.deleteMany({
    where: { questionBankId: bank.id },
  });
  console.log(`Cleaned up ${deleted.count} previous questions.`);

  // 2. Insert SBA Questions
  let orderIndex = 1;
  const sbaData = sba.map((q: any) => ({
    questionBankId: bank.id,
    questionText: `${q.vignette}\n\n${q.questionText}`,
    options: q.options,
    correctAnswer: q.correctAnswer ?? 0,
    explanation: q.explanation,
    subTopic: q.subTopic,
    order: orderIndex++,
    questionType: "SBA",
  }));

  // Batch insert SBA
  const batchSize = 50;
  for (let i = 0; i < sbaData.length; i += batchSize) {
    const batch = sbaData.slice(i, i + batchSize);
    await prisma.bankQuestion.createMany({
      data: batch,
    });
  }
  console.log(`Successfully inserted ${sbaData.length} SBA questions!`);

  // 3. Insert EMQ Themes
  const emqData = emq.map((theme: any) => ({
    questionBankId: bank.id,
    questionText: theme.title || `Theme ${theme.themeNumber}`,
    options: theme.options,
    correctAnswer: 0,
    explanation: theme.instruction || "For each case, select the single most appropriate answer from the option list.",
    subTopic: theme.subTopic,
    order: orderIndex++,
    questionType: "EMQ",
    themeNumber: theme.themeNumber,
    cases: theme.cases,
  }));

  for (let i = 0; i < emqData.length; i += batchSize) {
    const batch = emqData.slice(i, i + batchSize);
    await prisma.bankQuestion.createMany({
      data: batch,
    });
  }
  console.log(`Successfully inserted ${emqData.length} EMQ themes!`);

  // Update total question count in QuestionBank
  await prisma.questionBank.update({
    where: { id: bank.id },
    data: { questionCount: sbaData.length + emqData.length },
  });

  console.log(`Total questions in ${bank.title} now: ${sbaData.length + emqData.length}`);
}

// Run directly if invoked
seedCardiologyQuestions()
  .catch((err) => {
    console.error("Seed failed:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
