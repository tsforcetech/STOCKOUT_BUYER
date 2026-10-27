import { useQuery } from "@tanstack/react-query";
import { organizationsService } from "@/services/organizations.service";

export const orgKeys = {
  all: (orgId: string) => ["organization", orgId] as const,
  permissions: (orgId: string) => ["organization", orgId, "permissions"] as const,
  members: (orgId: string) => ["organization", orgId, "members"] as const,
  invitations: (orgId: string) => ["organization", orgId, "invitations"] as const,
  changes: (orgId: string) => ["organization", orgId, "business-changes"] as const,
  change: (orgId: string, id: string) => ["organization", orgId, "business-changes", id] as const,
  memberships: ["organization", "memberships"] as const,
};

/** The caller's company-scoped permissions; UI only hides actions, the server still decides. */
export function useOrgPermissions(orgId: string) {
  const q = useQuery({ queryKey: orgKeys.permissions(orgId), queryFn: ({ signal }) => organizationsService.myPermissions(orgId, signal), staleTime: 60_000 });
  const has = (code: string) => !!q.data?.permissions.includes(code);
  return { ...q, has };
}

const ZERO = "00000000-0000-0000-0000-000000000000";
/** The live members list can return an all-zero memberId (backend defect); such rows can't be acted on. */
export const hasMemberId = (id: string | null | undefined) => !!id && id !== ZERO;

/** UAE local time (GST, UTC+4) for server deadlines. */
export function formatGst(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return `${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d)} GST`;
}
