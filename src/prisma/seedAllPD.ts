import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

export async function seedAllPD() {
  const jsonPath = path.join(__dirname, "../../data/pd_all.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("pd_all.json not found at", jsonPath);
    return;
  }

  const allDomains = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const domainKeys = Object.keys(allDomains);
  console.log(`Starting bulk seed for all ${domainKeys.length} Professional Dilemmas domains...`);

  let grandTotalQuestions = 0;
  let grandTotalRanking = 0;
  let grandTotalSelect3 = 0;

  for (const key of domainKeys) {
    const item = allDomains[key];
    const { title, slug, description, questionCount, rankingCount, select3Count, questions } = item;
    console.log(`\n========================================`);
    console.log(`Seeding Domain: ${title} (${questionCount} questions: ${rankingCount} Ranking, ${select3Count} Select 3)...`);

    // 1. Find or create QuestionBank for this domain
    let bank = await prisma.questionBank.findFirst({
      where: {
        OR: [
          { title: title },
          { specialty: title },
          { description: { contains: slug } },
        ],
      },
    });

    if (!bank) {
      bank = await prisma.questionBank.create({
        data: {
          title,
          specialty: "Professional Dilemmas",
          category: "Professional Dilemmas",
          type: "SJT",
          description: description || `Official Professional Dilemmas Question Bank for ${title}.`,
          difficultyBadge: "STANDARD",
          difficultyType: "standard",
          durationMinutes: 45,
          questionCount: questions.length,
          isActive: true,
        },
      });
      console.log(`Created new SJT QuestionBank: ${bank.title} (${bank.id})`);
    } else {
      bank = await prisma.questionBank.update({
        where: { id: bank.id },
        data: {
          title,
          specialty: "Professional Dilemmas",
          category: "Professional Dilemmas",
          type: "SJT",
          description: description || bank.description,
          questionCount: questions.length,
          isActive: true,
        },
      });
      console.log(`Updated SJT QuestionBank: ${bank.title} (${bank.id})`);
    }

    // 2. Clean up old questions for this bank
    const deleted = await prisma.bankQuestion.deleteMany({
      where: { questionBankId: bank.id },
    });
    console.log(`Removed ${deleted.count} existing questions for clean seed.`);

    // 3. Prepare BankQuestion batch
    let orderIndex = 1;
    const questionsData = questions.map((q: any) => {
      const isRanking = q.questionType === "RANKING";
      return {
        questionBankId: bank.id,
        questionText: q.vignette && q.question ? `${q.vignette}\n\n${q.question}` : (q.vignette || q.question || "Scenario"),
        options: q.options || [],
        correctAnswer: 0,
        explanation: q.explanation || "",
        subTopic: q.subTopic || "General",
        order: orderIndex++,
        questionType: q.questionType, // "RANKING" or "SELECT_3"
        themeNumber: null,
        cases: isRanking
          ? {
              idealOrder: q.idealOrder || [],
              instruction: q.question || "Rank the following actions from most appropriate (1) to least appropriate (5).",
              references: q.references || "",
            }
          : {
              correctAnswers: q.correctAnswers || [],
              peerStats: q.peerStats || {},
              instruction: q.question || "Select the 3 most appropriate actions to take in this situation.",
              references: q.references || "",
            },
      };
    });

    // 4. Batch insert in chunks of 100
    const batchSize = 100;
    for (let i = 0; i < questionsData.length; i += batchSize) {
      const batch = questionsData.slice(i, i + batchSize);
      await prisma.bankQuestion.createMany({
        data: batch,
      });
    }

    grandTotalQuestions += questions.length;
    grandTotalRanking += rankingCount;
    grandTotalSelect3 += select3Count;
    console.log(`Successfully seeded ${questions.length} questions for ${title}.`);
  }

  console.log(`\n=======================================================`);
  console.log(`Grand Total Seed Complete:`);
  console.log(`  Total Professional Dilemmas Questions: ${grandTotalQuestions}`);
  console.log(`  Total Ranking: ${grandTotalRanking}`);
  console.log(`  Total Select 3: ${grandTotalSelect3}`);
  console.log(`=======================================================`);
}

if (import.meta.main) {
  seedAllPD()
    .then(() => {
      console.log("PD Seeding completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("PD Seeding failed:", err);
      process.exit(1);
    });
}
