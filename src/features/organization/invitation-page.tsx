import * as React from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BuildingsIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { FormError } from "@/components/forms/form-field";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { isApiError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDateTime } from "@/lib/utils/format";
import { organizationsService } from "@/services/organizations.service";
import { useAuthDialog } from "@/features/auth/auth-dialog";
import { orgErrorMessage } from "./messages";

/**
 * /invitations/:token — company invitation landing (PA-1B.2). Preview is public (masked email); accepting needs a
 * signed-in account with the invited email. The token stays in the URL path only and is never logged.
 */
export default function InvitationPage() {
  const { token = "" } = useParams();
  const { status, reloadActor } = useAuth();
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const preview = useQuery({ queryKey: ["invitation-preview", token], queryFn: ({ signal }) => organizationsService.previewInvitation(token, signal), retry: false, staleTime: Infinity });
  const [error, setError] = React.useState<string | null>(null);
  const accept = useApiMutation({
    toastOnError: false,
    mutationFn: () => organizationsService.acceptInvitation(token),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["organization"] });
      await reloadActor();
    },
  });
  const p = preview.data;
  const state = (p?.status ?? "").toUpperCase();
  const expired = !!p && (new Date(p.expiresAtUtc.endsWith("Z") ? p.expiresAtUtc : `${p.expiresAtUtc}Z`).getTime() < Date.now() || state === "EXPIRED");
  const usable = !!p && !expired && ["INVITED", "PENDING", "SENT"].includes(state);
  const onAccept = () => {
    setError(null);
    if (status !== "authenticated") return openAuth({ reason: "Log in or create an account with the invited email to join this company." });
    accept.mutate(undefined, { onError: (e) => setError(orgErrorMessage(e)) });
  };
  const notFound = preview.error && isApiError(preview.error) && (preview.error.status === 404 || preview.error.status === 400);
  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:py-16">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-raised sm:p-8">
        <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-action-soft ring-1 ring-action-border/30" aria-hidden>
          <BuildingsIcon className="size-6" />
        </span>
        {preview.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : accept.isSuccess ? (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground">You've joined {accept.data.organizationName}</h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircleIcon className="size-5 text-success" weight="fill" aria-hidden /> Role: {accept.data.roleCode}
            </p>
            <Button className="mt-6" onClick={() => void navigate("/seller")}>
              Open seller portal
            </Button>
          </>
        ) : notFound || !p ? (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground">Invitation not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This link isn't valid any more. Ask the company to send you a new invitation.</p>
            <Button asChild variant="secondary" className="mt-6">
              <Link to="/">Go to StockOut</Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="font-heading text-2xl font-bold text-foreground">Join {p.organizationName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You've been invited as <span className="font-medium text-foreground">{p.roleCode}</span>. The invitation was sent to{" "}
              <span className="font-medium text-foreground">{p.maskedEmail}</span>.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{expired ? "Expired" : "Expires"} {formatDateTime(p.expiresAtUtc)}</p>
            <FormError message={error} />
            {usable ? (
              <Button className="mt-6 w-full" size="lg" onClick={onAccept} loading={accept.isPending}>
                {status === "authenticated" ? "Accept invitation" : "Log in or register to accept"}
              </Button>
            ) : (
              <p className="mt-6 rounded-lg bg-surface-muted p-3 text-sm text-body">
                {expired ? "This invitation has expired. Ask the company to resend it." : `This invitation is ${state.toLowerCase() || "no longer valid"}.`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
