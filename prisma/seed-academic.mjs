// Seeds the academic hierarchy (stage > grade > subject > unit) and one
// central demo lesson (schoolId = null — visible to every school).
// Idempotent: skips when a stage already exists.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUBJECTS = ["الرياضيات", "العلوم", "اللغة العربية", "اللغة الإنجليزية"];

async function main() {
  const existing = await prisma.academicStage.count();
  if (existing > 0) {
    console.log("Academic hierarchy already seeded — skipping.");
    return;
  }

  const stage = await prisma.academicStage.create({
    data: { name: "المرحلة المتوسطة" },
  });

  const gradeNames = ["الأول المتوسط", "الثاني المتوسط", "الثالث المتوسط"];
  const grades = [];
  for (const name of gradeNames) {
    grades.push(await prisma.grade.create({ data: { name, stageId: stage.id } }));
  }

  let firstMathUnitId = null;
  for (const grade of grades) {
    for (const subjectName of SUBJECTS) {
      const subject = await prisma.subject.create({
        data: { name: subjectName, gradeId: grade.id },
      });
      for (const unitTitle of ["الوحدة الأولى", "الوحدة الثانية"]) {
        const unit = await prisma.unit.create({
          data: { title: `${unitTitle}: ${subjectName}`, subjectId: subject.id },
        });
        if (!firstMathUnitId && grade === grades[0] && subjectName === "الرياضيات") {
          firstMathUnitId = unit.id;
        }
      }
    }
  }

  // Central content: schoolId = null → visible to students of every school.
  await prisma.lesson.create({
    data: {
      title: "درس تجريبي مركزي من مدار",
      unitId: firstMathUnitId,
      status: "PUBLISHED",
      schoolId: null,
    },
  });

  console.log(
    `Seeded: 1 stage, ${grades.length} grades, ${grades.length * SUBJECTS.length} subjects, ` +
      `${grades.length * SUBJECTS.length * 2} units, 1 central lesson.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
