import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// Creates an IN_APP notification row (+ email placeholder) for a user.
export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  options: { email?: string | null } = {}
): Promise<void> {
  await prisma.notification.create({
    data: { userId, title, body, channel: "IN_APP" },
  });
  await sendEmail(options.email ?? "(unknown email)", title, body);
}

// Same notification for many users at once.
export async function notifyUsers(
  users: { id: string; email: string }[],
  title: string,
  body: string
): Promise<void> {
  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((u) => ({
      userId: u.id,
      title,
      body,
      channel: "IN_APP",
    })),
  });
  for (const u of users) {
    await sendEmail(u.email, title, body);
  }
}
