// Permission helpers — Phase 0 creates empty stubs only.
// Full logic is implemented in Phase A per the plan:
//  - requireRole: reads the Supabase session (lib/supabase/server),
//    loads the matching User row and checks the role.
//  - withSchoolScope: secondary defense layer on top of RLS.

export async function requireRole(roles: string[]) {
  // TODO: implement in Phase A
}

export function withSchoolScope(schoolId: string, whereClause: object) {
  // TODO: implement in Phase A
}
