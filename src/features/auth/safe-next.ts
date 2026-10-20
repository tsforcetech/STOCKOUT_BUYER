/** Only same-site paths are followed after sign-in ("//evil.com" and absolute URLs fall back to home). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
