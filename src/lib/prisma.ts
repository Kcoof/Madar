import { PrismaClient } from "@prisma/client";

// Prisma Client singleton — used ONLY for schema management and migrations.
// Application queries go through Supabase clients so RLS is enforced.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
