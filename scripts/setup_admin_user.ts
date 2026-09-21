import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma";
import { AccountStatus } from "../src/generated/prisma";

async function main() {
  console.log("Connecting to database to setup admin credentials...");

  // 1. Ensure "admin" role exists
  let adminRole = await prisma.role.findFirst({
    where: { name: "admin" },
  });

  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: "admin",
        description: "Administrator with full system access",
      },
    });
    console.log("Created 'admin' role.");
  } else {
    console.log("Found 'admin' role:", adminRole.id);
  }

  // Admin user credentials
  const email = "admin@example.com";
  const password = "Admin123!";
  const hashedPassword = await bcrypt.hash(password, 10);
  const now = new Date();

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: { email },
    include: { role: true },
  });

  let user;
  if (existingUser) {
    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        roleId: adminRole.id,
        password: hashedPassword,
        status: AccountStatus.active,
        emailVerifiedAt: existingUser.emailVerifiedAt || now,
        firstName: existingUser.firstName || "Admin",
        lastName: existingUser.lastName || "User",
      },
      include: { role: true },
    });
    console.log("Updated existing user to Admin with new password.");
  } else {
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: "System",
        lastName: "Admin",
        displayName: "System Administrator",
        status: AccountStatus.active,
        emailVerifiedAt: now,
        roleId: adminRole.id,
      },
      include: { role: true },
    });
    console.log("Created new Admin user.");
  }

  console.log("\n==========================================");
  console.log("ADMIN DASHBOARD CREDENTIALS READY");
  console.log("==========================================");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role:     ${user.role?.name}`);
  console.log(`Status:   ${user.status}`);
  console.log("==========================================\n");
}

main()
  .catch((err) => {
    console.error("Error setting up admin credentials:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
