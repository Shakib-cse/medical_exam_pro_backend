import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

export async function seedFreeSample() {
  const jsonPath = path.join(__dirname, "../../data/free_sample_all.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("free_sample_all.json not found at", jsonPath);
    return;
  }

  const freeData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log("Seeding Free Sample questions into database...");

  for (const [specialtyName, questions] of Object.entries(freeData) as [string, any[]][]) {
    // 1. Find matching QuestionBank
    let bank = await prisma.questionBank.findFirst({
      where: {
        OR: [
          { title: specialtyName },
          { specialty: specialtyName },
          { title: { contains: specialtyName.split(" ")[0] } },
        ],
      },
    });

    const isSJT = specialtyName.includes("Professional") || specialtyName.includes("Integrity");

    if (!bank) {
      bank = await prisma.questionBank.create({
        data: {
          title: specialtyName,
          specialty: specialtyName,
          category: isSJT ? "Professional Dilemmas" : "Clinical Practice",
          type: isSJT ? "SJT" : "Clinical",
          difficultyBadge: "MODERATE",
          difficultyType: "moderate",
          durationMinutes: 15,
          questionCount: questions.length,
          isFree: true,
          isActive: true,
        },
      });
      console.log(`Created new QuestionBank: ${bank.title} (${bank.id})`);
    } else {
      await prisma.questionBank.update({
        where: { id: bank.id },
        data: { isFree: true },
      });
      console.log(`Using existing QuestionBank: ${bank.title} (${bank.id})`);
    }

    // 2. Remove previously seeded free sample questions for this bank
    await prisma.bankQuestion.deleteMany({
      where: {
        questionBankId: bank.id,
        isFree: true,
      },
    });

    // 3. Insert free sample questions
    let inserted = 0;
    for (const q of questions) {
      await prisma.bankQuestion.create({
        data: {
          questionBankId: bank.id,
          questionText: q.questionText,
          options: q.options || [],
          correctAnswer: q.correctAnswer ?? 0,
          explanation: q.explanation || null,
          questionType: q.questionType || "SBA",
          themeNumber: q.themeNumber || null,
          cases: q.cases || null,
          order: q.order || 1,
          isFree: true,
        },
      });
      inserted++;
    }

    console.log(`  -> Inserted ${inserted} Free Sample questions for ${specialtyName}`);
  }

  console.log("Free Sample questions seeding completed successfully!");
}

if (import.meta.main) {
  seedFreeSample()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
