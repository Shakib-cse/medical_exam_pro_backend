import { prisma } from "../src/lib/prisma";

async function checkDb() {
  const banks = await prisma.questionBank.findMany({
    include: {
      _count: {
        select: { questions: true }
      }
    },
    orderBy: { specialty: "asc" }
  });

  console.log(`Found ${banks.length} QuestionBanks in DB:\n`);
  let totalDbQuestions = 0;
  let totalDbSba = 0;
  let totalDbEmq = 0;
  let totalCases = 0;

  for (const b of banks) {
    const sbaCount = await prisma.bankQuestion.count({
      where: { questionBankId: b.id, questionType: "SBA" }
    });
    const emqCount = await prisma.bankQuestion.count({
      where: { questionBankId: b.id, questionType: "EMQ" }
    });
    
    // Count total cases inside EMQ
    const emqs = await prisma.bankQuestion.findMany({
      where: { questionBankId: b.id, questionType: "EMQ" },
      select: { cases: true }
    });
    let casesInBank = 0;
    for (const eq of emqs) {
      if (Array.isArray(eq.cases)) {
        casesInBank += (eq.cases as any[]).length;
      }
    }

    totalDbQuestions += b._count.questions;
    totalDbSba += sbaCount;
    totalDbEmq += emqCount;
    totalCases += casesInBank;

    console.log(`${b.specialty} (${b.title}):`);
    console.log(`   DB Questions: ${b._count.questions} (SBA: ${sbaCount}, EMQ Themes: ${emqCount}) | EMQ Cases: ${casesInBank} | Total Questions (SBA + Cases): ${sbaCount + casesInBank}`);
  }

  console.log("\n=================================");
  console.log(`Grand Total DB QuestionBank records: ${banks.length}`);
  console.log(`Grand Total DB BankQuestion records: ${totalDbQuestions} (SBA: ${totalDbSba}, EMQ Themes: ${totalDbEmq})`);
  console.log(`Grand Total EMQ Cases stored in DB: ${totalCases}`);
  console.log(`Grand Total Question Items (SBA + EMQ Cases): ${totalDbSba + totalCases}`);
}

checkDb().catch(console.error).finally(() => process.exit(0));
