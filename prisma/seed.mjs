// Seeds the initial MADAR_OWNER account (idempotent).
// Local dev credentials: owner@madar.local / MadarOwner#2026
// On Supabase, create the owner through the dashboard instead and set the
// role directly in the database — this script is for local development.
import { randomBytes, randomUUID, scryptSync } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OWNER_EMAIL = "owner@madar.local";
const OWNER_PASSWORD = "MadarOwner#2026";
const OWNER_FULL_NAME = "مالك مدار";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (existing) {
    console.log(`MADAR_OWNER already exists: ${OWNER_EMAIL}`);
    return;
  }

  const id = randomUUID();
  // Insert into auth.users — the handle_new_user trigger creates the User row.
  await prisma.$executeRaw`
    insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
    values (${id}::uuid, ${OWNER_EMAIL}, ${hashPassword(OWNER_PASSWORD)}, ${JSON.stringify({ fullName: OWNER_FULL_NAME })}::jsonb)
  `;
  await prisma.user.update({
    where: { id },
    data: { role: "MADAR_OWNER", isActive: true, fullName: OWNER_FULL_NAME },
  });

  console.log(`MADAR_OWNER created: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
