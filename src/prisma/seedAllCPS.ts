import { prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

export async function seedAllCPS() {
  const jsonPath = path.join(__dirname, "../../data/cps_all.json");
  if (!fs.existsSync(jsonPath)) {
    console.error("cps_all.json not found at", jsonPath);
    return;
  }

  const allSpecialties = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`Starting bulk seed for all ${allSpecialties.length} CPS specialties...`);

  let totalSeededSba = 0;
  let totalSeededEmq = 0;

  for (const item of allSpecialties) {
    const { title, specialty, description, sba, emq } = item;
    console.log(`\n========================================`);
    console.log(`Seeding: ${title} (${sba.length} SBA, ${emq.length} EMQ themes)...`);

    // 1. Find or create QuestionBank
    let bank = await prisma.questionBank.findFirst({
      where: {
        OR: [
          { specialty: specialty },
          { title: title },
          // Match previous cardiology if needed
          ...(specialty === "Cardiovascular Medicine" ? [{ specialty: "Cardiovascular Medicine" }] : []),
        ],
      },
    });

    if (!bank) {
      bank = await prisma.questionBank.create({
        data: {
          title,
          specialty,
          category: "Clinical Practice",
          type: "Clinical",
          description: description || `Official CPS ${title} Question Bank containing SBA and EMQ questions.`,
          difficultyBadge: "CLINICAL",
          difficultyType: "clinical",
          durationMinutes: 45,
          questionCount: sba.length + emq.length,
          isActive: true,
        },
      });
      console.log(`Created new QuestionBank: ${bank.title} (${bank.id})`);
    } else {
      // Update title, specialty, description if needed
      bank = await prisma.questionBank.update({
        where: { id: bank.id },
        data: {
          title,
          specialty,
          description: description || bank.description,
          isActive: true,
        },
      });
      console.log(`Updated QuestionBank: ${bank.title} (${bank.id})`);
    }

    // 2. Clean up old questions for this bank
    const deleted = await prisma.bankQuestion.deleteMany({
      where: { questionBankId: bank.id },
    });
    console.log(`Removed ${deleted.count} existing questions for clean seed.`);

    // 3. Prepare SBA questions
    let orderIndex = 1;
    const sbaData = sba.map((q: any) => ({
      questionBankId: bank.id,
      questionText: q.questionText && q.vignette && q.questionText !== q.vignette
        ? `${q.vignette}\n\n${q.questionText}`
        : q.vignette || q.questionText || "Clinical question",
      options: q.options || [],
      correctAnswer: q.correctAnswer ?? 0,
      explanation: q.explanation || "Standard clinical explanation.",
      subTopic: q.subTopic || "General",
      order: orderIndex++,
      questionType: "SBA",
    }));

    // Batch insert SBA in chunks of 100
    const batchSize = 100;
    for (let i = 0; i < sbaData.length; i += batchSize) {
      const batch = sbaData.slice(i, i + batchSize);
      await prisma.bankQuestion.createMany({
        data: batch,
      });
    }

    // 4. Prepare EMQ questions
    const emqData = emq.map((theme: any) => ({
      questionBankId: bank.id,
      questionText: theme.title || `Theme ${theme.themeNumber}`,
      options: theme.options || [],
      correctAnswer: 0,
      explanation: theme.instruction || "For each case, select the single most appropriate answer from the option list.",
      subTopic: theme.subTopic || "General",
      order: orderIndex++,
      questionType: "EMQ",
      themeNumber: theme.themeNumber || null,
      cases: theme.cases || [],
    }));

    for (let i = 0; i < emqData.length; i += batchSize) {
      const batch = emqData.slice(i, i + batchSize);
      await prisma.bankQuestion.createMany({
        data: batch,
      });
    }

    // 5. Update QuestionBank question count
    const totalCount = sbaData.length + emqData.length;
    await prisma.questionBank.update({
      where: { id: bank.id },
      data: { questionCount: totalCount },
    });

    totalSeededSba += sbaData.length;
    totalSeededEmq += emqData.length;
    console.log(`✓ Seeded ${sbaData.length} SBA + ${emqData.length} EMQ (${totalCount} total) for ${bank.title}`);
  }

  console.log(`\n========================================`);
  console.log(`ALL 18 SPECIALTIES SEEDED SUCCESSFULLY!`);
  console.log(`Total SBA questions inserted: ${totalSeededSba}`);
  console.log(`Total EMQ themes inserted: ${totalSeededEmq}`);
  console.log(`Total database questions: ${totalSeededSba + totalSeededEmq}`);
  console.log(`========================================`);
}

// If executed directly
if (require.main === module) {
  seedAllCPS()
    .then(() => {
      console.log("Seeding process completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
