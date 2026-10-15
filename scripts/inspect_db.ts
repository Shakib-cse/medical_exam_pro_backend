import { prisma } from '../src/lib/prisma';

async function main() {
  const bankQTypes = await prisma.bankQuestion.groupBy({
    by: ['questionType'],
    _count: { id: true }
  });
  console.log("BankQuestion questionTypes:", bankQTypes);

  const mockQTypes = await prisma.mockQuestion.groupBy({
    by: ['questionType'],
    _count: { id: true }
  });
  console.log("MockQuestion questionTypes:", mockQTypes);

  const emqBankQuestions = await prisma.bankQuestion.findMany({
    where: { questionType: "EMQ" },
    take: 5,
    select: { id: true, questionType: true, cases: true, questionText: true, questionBankId: true }
  });
  console.log("BankQuestions with questionType=EMQ:", emqBankQuestions);

  const emqMockQuestions = await prisma.mockQuestion.findMany({
    where: { questionType: "EMQ" },
    take: 5,
    select: { id: true, questionType: true, cases: true, questionText: true, mockExamId: true }
  });
  console.log("MockQuestions with questionType=EMQ:", emqMockQuestions);

  // Check QuestionBank records
  const banks = await prisma.questionBank.findMany({
    select: { id: true, title: true, specialty: true, type: true, questionCount: true }
  });
  console.log("QuestionBanks count:", banks.length);
  console.log("Sample QuestionBanks:", banks.slice(0, 5));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
