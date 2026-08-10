import { prisma } from "../lib/prisma";

export async function seedMockExams() {
  const existingCount = await prisma.mockExam.count();
  if (existingCount > 0) {
    console.log("Mock exams already seeded. Skipping...");
    return;
  }

  console.log("Seeding mock exams...");

  const mockExamsData = [
    {
      title: "Cardiology & Respiratory Focus",
      difficultyBadge: "MODERATE",
      difficultyType: "moderate",
      durationMinutes: 45,
      questionCount: 50,
      category: "Cardiology",
      questions: [
        {
          questionText: "A 65-year-old male presents with acute shortness of breath and elevated troponin levels. What is the most appropriate immediate diagnostic test?",
          options: ["12-Lead ECG", "Chest X-Ray", "CT Pulmonary Angiogram", "Echocardiogram"],
          correctAnswer: 0,
          explanation: "A 12-lead ECG should be performed immediately within 10 minutes of presentation for suspected acute coronary syndrome.",
          order: 1,
        },
        {
          questionText: "Which ECG finding is most characteristic of acute pericarditis?",
          options: ["Widespread ST-segment elevation with PR depression", "Isolated T-wave inversion in V1-V3", "Pathologic Q waves", "QT prolongation"],
          correctAnswer: 0,
          explanation: "Widespread PR-segment depression and concave ST-segment elevation are hallmark features of acute pericarditis.",
          order: 2,
        },
      ],
    },
    {
      title: "Neurology & Renal Deep Dive",
      difficultyBadge: "ADVANCED",
      difficultyType: "advanced",
      durationMinutes: 45,
      questionCount: 50,
      category: "Neurology",
      questions: [
        {
          questionText: "A 42-year-old female experiences acute right-sided weakness and facial drooping that resolved after 2 hours. What is the initial management step?",
          options: ["Aspirin 300mg and urgent TIA pathway referral", "Thrombolysis immediately", "Intracranial stent placement", "Lumbar puncture"],
          correctAnswer: 0,
          explanation: "High-dose aspirin 300mg should be given immediately after TIA diagnosis (excluding intracranial hemorrhage) alongside specialist assessment.",
          order: 1,
        },
      ],
    },
    {
      title: "SJT Professionalism Module",
      difficultyBadge: "CLINICAL",
      difficultyType: "clinical",
      durationMinutes: 30,
      questionCount: 40,
      category: "SJT",
      questions: [
        {
          questionText: "A colleague notices a senior doctor smells strongly of alcohol during morning rounds. What is the most appropriate initial action?",
          options: ["Discuss concerns directly with the senior doctor or report to the clinical supervisor immediately", "Ignore it if patient care is unaffected", "Post about it on social media", "Wait until the end of the shift"],
          correctAnswer: 0,
          explanation: "Patient safety is paramount; concerns regarding impairment must be raised promptly with supervisors or occupational health.",
          order: 1,
        },
      ],
    },
    {
      title: "Mixed Clinical Review",
      difficultyBadge: "STANDARD",
      difficultyType: "standard",
      durationMinutes: 60,
      questionCount: 70,
      category: "Mixed",
      questions: [
        {
          questionText: "A 28-year-old presenting with acute right lower quadrant pain and fever. What is the classic physical exam sign for appendicitis?",
          options: ["Rovsing's Sign", "Trousseau's Sign", "Chvostek's Sign", "Murphy's Sign"],
          correctAnswer: 0,
          explanation: "Rovsing's sign (palpation of RLQ causes pain in RLQ) is classic for acute appendicitis.",
          order: 1,
        },
      ],
    },
  ];

  for (const examData of mockExamsData) {
    const { questions, ...exam } = examData;
    await prisma.mockExam.create({
      data: {
        ...exam,
        questions: {
          create: questions,
        },
      },
    });
  }

  console.log("Mock exams seeded successfully!");
}
