import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// LOCAL DEV ONLY — used when no Supabase project is connected.
// Mirrors the Supabase Auth flow against the local auth.users stub:
// registering inserts into auth.users, which fires the handle_new_user
// trigger and creates the public.User row (exactly like Supabase).
// Never active when NEXT_PUBLIC_SUPABASE_URL is configured.

const DEV_COOKIE = "madar_dev_session";
const DEV_SECRET = process.env.DEV_AUTH_SECRET || "madar-local-dev-secret";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

function sign(userId: string): string {
  return createHmac("sha256", DEV_SECRET).update(userId).digest("hex");
}

export async function setDevSession(userId: string) {
  cookies().set(DEV_COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearDevSession() {
  cookies().delete(DEV_COOKIE);
}

export async function getDevSessionUserId(): Promise<string | null> {
  const raw = cookies().get(DEV_COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const userId = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  return sign(userId) === signature ? userId : null;
}

// Creates an auth.users row (trigger creates the public.User row) and returns the new id.
export async function devCreateAuthUser(
  email: string,
  password: string,
  fullName: string
): Promise<string> {
  const id = randomUUID();
  await prisma.$executeRaw`
    insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
    values (${id}::uuid, ${email.toLowerCase()}, ${hashPassword(password)}, ${JSON.stringify({ fullName })}::jsonb)
  `;
  return id;
}

// Verifies credentials against the local auth.users stub. Returns the user id or null.
export async function devVerifyLogin(email: string, password: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<
    { id: string; encrypted_password: string | null }[]
  >`
    select id, encrypted_password from auth.users where email = ${email.toLowerCase()}
  `;
  const row = rows[0];
  if (!row?.encrypted_password) return null;
  return verifyPassword(password, row.encrypted_password) ? row.id : null;
}
