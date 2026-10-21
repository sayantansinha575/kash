// Client-side runtime error reporting
export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[Runtime Error]", error, context);
}
