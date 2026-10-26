import { useQuery } from "@tanstack/react-query";
import { policiesService } from "@/services/policies.service";

export const policyKeys = {
  list: ["policies", "list"] as const,
  detail: (code: string) => ["policies", "detail", code] as const,
  pending: ["policies", "me", "pending"] as const,
  acceptances: ["policies", "me", "acceptances"] as const,
  cookies: (subject: string) => ["privacy", "cookies", subject] as const,
  communication: ["privacy", "communication"] as const,
};

/** Readable URLs for the published documents; unknown codes are linked by their code. */
export const POLICY_SLUGS: Record<string, string> = {
  "STK-POL-WEB-001": "terms",
  "STK-POL-PRV-001": "privacy",
  "STK-POL-CKE-001": "cookies",
  "STK-POL-PRH-001": "prohibited-items",
  "STK-POL-BSP-001": "buyer-seller-policy",
  "STK-POL-AUP-001": "acceptable-use",
  "STK-POL-INS-001": "inspection-terms",
};

export const policyPath = (code: string) => `/legal/${POLICY_SLUGS[code] ?? encodeURIComponent(code)}`;
export const codeFromSlug = (slug: string) => Object.entries(POLICY_SLUGS).find(([, s]) => s === slug)?.[0] ?? slug;

export function usePolicies() {
  return useQuery({ queryKey: policyKeys.list, queryFn: ({ signal }) => policiesService.list(signal), staleTime: 10 * 60_000 });
}

export function usePolicy(code: string | null | undefined) {
  return useQuery({
    queryKey: policyKeys.detail(code ?? ""),
    queryFn: ({ signal }) => policiesService.detail(code as string, signal),
    enabled: !!code,
    staleTime: 10 * 60_000,
  });
}
