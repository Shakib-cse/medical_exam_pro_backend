import { seedAdminUser } from "./seedAdmin";
import { seedMockExams } from "./seedMockExams";

async function main() {
  console.log("Starting database seeding...");
  await seedAdminUser();
  await seedMockExams();
  console.log("Database seeding completed.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
