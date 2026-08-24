// Seeds the subscription plans (idempotent by name).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLANS = [
  { type: "FULL_YEAR", name: "الاشتراك السنوي الشامل", price: 1200 },
  { type: "SINGLE_SUBJECT", name: "اشتراك مادة واحدة", price: 300 },
];

async function main() {
  for (const plan of PLANS) {
    const existing = await prisma.subscriptionPlan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.subscriptionPlan.create({ data: plan });
      console.log(`Created plan: ${plan.name}`);
    }
  }
  console.log("Subscription plans ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
