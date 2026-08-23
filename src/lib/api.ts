import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Unified API error — every failed response returns { error: { code, message } }
// (fixed decision 6 in madar_plan_v2.0.md).
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "بيانات غير صالحة",
        },
      },
      { status: 400 }
    );
  }
  console.error("[api] unexpected error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "حدث خطأ غير متوقع" } },
    { status: 500 }
  );
}
