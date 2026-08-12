import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { AccountStatus } from "../generated/prisma";

export async function seedAdminUser() {
  console.log("Checking admin user setup...");

  // 1. Ensure "admin" role exists
  let adminRole = await prisma.role.findFirst({
    where: { name: "admin" },
  });

  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: "admin",
        description: "Administrator Role with full access",
      },
    });
    console.log("Created 'admin' role in database.");
  } else {
    console.log("Found existing 'admin' role.");
  }

  // 2. Admin User Details
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  // Check if admin user exists
  const existingUser = await prisma.user.findFirst({
    where: { email: adminEmail },
    include: { role: true },
  });

  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const now = new Date();

  if (existingUser) {
    // Update existing user to ensure admin role, active status, and verified email
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        roleId: adminRole.id,
        status: AccountStatus.active,
        emailVerifiedAt: existingUser.emailVerifiedAt || now,
        password: hashedPassword,
      },
    });
    console.log(`Updated existing user (${adminEmail}) to Admin role with verified status.`);
  } else {
    // Create new admin user
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        firstName: "System",
        lastName: "Admin",
        displayName: "System Administrator",
        status: AccountStatus.active,
        emailVerifiedAt: now,
        roleId: adminRole.id,
      },
    });
    console.log(`Created new Admin user (${adminEmail}).`);
  }

  console.log("\n==========================================");
  console.log("🔑 ADMIN CREATOR SUMMARY");
  console.log("------------------------------------------");
  console.log(`Email:          ${adminEmail}`);
  console.log(`Password:       ${adminPassword}`);
  console.log(`Role:           admin`);
  console.log(`Status:         active`);
  console.log(`Email Verified: Yes`);
  console.log("==========================================\n");
}

if (import.meta.main || require.main === module) {
  seedAdminUser()
    .then(() => {
      console.log("Admin seeding process completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error seeding admin user:", err);
      process.exit(1);
    });
}
