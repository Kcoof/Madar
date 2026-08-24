// Email channel placeholder — a real SMTP/provider integration comes with
// deployment. SMS/WhatsApp are explicitly out of MVP scope (plan, Phase F).
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  console.log(`[email placeholder] to=${to} subject="${subject}" body="${body}"`);
}
