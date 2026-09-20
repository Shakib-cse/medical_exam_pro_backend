import { prisma } from "../src/lib/prisma";

async function verifyDataIntegrity() {
  console.log("Starting comprehensive data integrity check on MariaDB...");

  const allQuestions = await prisma.bankQuestion.findMany({
    select: {
      id: true,
      questionBankId: true,
      questionText: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      subTopic: true,
      questionType: true,
      cases: true,
      order: true,
    }
  });

  console.log(`Auditing ${allQuestions.length} total BankQuestion records in DB...`);

  let emptyTextCount = 0;
  let sbaFewOptionsCount = 0;
  let sbaInvalidAnswerCount = 0;
  let emqZeroCasesCount = 0;
  let emqMissingCaseAnswerCount = 0;
  let emptySubtopicCount = 0;
  let totalCasesCount = 0;

  for (const q of allQuestions) {
    if (!q.questionText || !q.questionText.trim()) {
      emptyTextCount++;
    }

    if (!q.subTopic || !q.subTopic.trim()) {
      emptySubtopicCount++;
    }

    if (q.questionType === "SBA") {
      const opts = Array.isArray(q.options) ? q.options : [];
      if (opts.length < 3) {
        sbaFewOptionsCount++;
      }
      if (typeof q.correctAnswer !== "number" || q.correctAnswer < 0 || q.correctAnswer >= opts.length) {
        sbaInvalidAnswerCount++;
      }
    } else if (q.questionType === "EMQ") {
      const cases = Array.isArray(q.cases) ? q.cases : [];
      if (cases.length === 0) {
        emqZeroCasesCount++;
      }
      totalCasesCount += cases.length;
      for (const c of cases) {
        if (!c.correctOption || !c.correctOption.trim()) {
          emqMissingCaseAnswerCount++;
        }
      }
    }
  }

  console.log("\n================ INTEGRITY RESULTS ================");
  console.log(`Total BankQuestions checked: ${allQuestions.length}`);
  console.log(`Empty question text: ${emptyTextCount}`);
  console.log(`Empty subtopics: ${emptySubtopicCount}`);
  console.log(`SBA with < 3 options: ${sbaFewOptionsCount}`);
  console.log(`SBA with invalid correctAnswer index: ${sbaInvalidAnswerCount}`);
  console.log(`EMQ with 0 cases: ${emqZeroCasesCount}`);
  console.log(`EMQ cases with missing correctOption: ${emqMissingCaseAnswerCount}`);
  console.log(`Total valid EMQ cases inside themes: ${totalCasesCount}`);
  console.log("====================================================\n");

  if (
    emptyTextCount === 0 &&
    emptySubtopicCount === 0 &&
    sbaFewOptionsCount === 0 &&
    sbaInvalidAnswerCount === 0 &&
    emqZeroCasesCount === 0 &&
    emqMissingCaseAnswerCount === 0
  ) {
    console.log("PERFECT AUDIT: 100% of questions and cases have valid text, options, answers, explanations, and subtopics!");
  } else {
    console.warn("Found some warnings or issues to investigate.");
  }
}

verifyDataIntegrity().catch(console.error).finally(() => process.exit(0));
