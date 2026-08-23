// Shared visibility rule for student-facing content: PUBLISHED lessons of the
// student's grade, from central Madar (schoolId = null) or the student's own
// school — nothing else (matches /api/student/lessons).
export function visiblePublishedLessonsWhere(student: {
  gradeId: string | null;
  schoolId: string | null;
}) {
  if (!student.gradeId) return null;
  return {
    status: "PUBLISHED" as const,
    unit: { subject: { gradeId: student.gradeId } },
    OR: [
      { schoolId: null },
      ...(student.schoolId ? [{ schoolId: student.schoolId }] : []),
    ],
  };
}
