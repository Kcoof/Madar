// Client-side fetch helper — unwraps the unified { error: { code, message } }
// error shape into a normal Error with the Arabic message.
export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "حدث خطأ غير متوقع");
  }
  return data as T;
}
