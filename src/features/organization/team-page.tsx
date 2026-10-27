import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowsClockwiseIcon, CrownIcon, EnvelopeSimpleIcon, PaperPlaneTiltIcon, UserPlusIcon, XIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { RefreshButton, SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { FormError, FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Badge, Skeleton, Tooltip } from "@/components/ui/misc";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { organizationsService } from "@/services/organizations.service";
import { INVITABLE_ROLES, ORG_PERMS, type OrganizationMemberResponse, type OrganizationRoleCode } from "@/api/types/organizations";
import { useActiveSeller } from "@/features/seller/lib/queries";
import { orgErrorMessage } from "./messages";
import { hasMemberId, orgKeys, useOrgPermissions } from "./queries";

const LAST_OWNER = "The company needs at least one active owner. Transfer ownership first.";

/** PA-1B.2 company team: members, roles and invitations for the active seller company. */
export default function TeamPage() {
  const orgId = useActiveSeller().sellerId;
  const perms = useOrgPermissions(orgId);
  const [tab, setTab] = React.useState<"members" | "invitations">("members");
  const [inviting, setInviting] = React.useState(false);
  const canView = perms.has(ORG_PERMS.MEMBERS_VIEW);
  return (
    <>
      <PageHeader
        eyebrow="Seller portal"
        title="Team"
        description="People who can work on this company's account, their roles and pending invitations."
        actions={
          perms.has(ORG_PERMS.MEMBERS_INVITE) && (
            <Button variant="action" onClick={() => setInviting(true)}>
              <UserPlusIcon /> Invite member
            </Button>
          )
        }
      />
      {perms.isLoading ? (
        <SectionCard>
          <Skeleton className="h-40 w-full" />
        </SectionCard>
      ) : perms.error ? (
        <SectionCard>
          <ErrorState error={perms.error} onRetry={() => void perms.refetch()} title="Couldn't load your company permissions" />
        </SectionCard>
      ) : !canView ? (
        <SectionCard>
          <EmptyState title="You can't view the team" description="Your role in this company doesn't include viewing members. Ask an owner or admin." />
        </SectionCard>
      ) : (
        <SectionCard>
          <div className="mb-4 flex gap-2" role="tablist" aria-label="Team sections">
            {(["members", "invitations"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={
                  "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors " +
                  (tab === t ? "border-foreground bg-foreground font-medium text-background" : "border-border hover:bg-surface-muted")
                }
              >
                {t === "members" ? "Members" : "Invitations"}
              </button>
            ))}
          </div>
          {tab === "members" ? <Members orgId={orgId} perms={perms} /> : <Invitations orgId={orgId} canInvite={perms.has(ORG_PERMS.MEMBERS_INVITE)} />}
        </SectionCard>
      )}
      <InviteDialog orgId={orgId} open={inviting} onOpenChange={setInviting} />
    </>
  );
}

type Action = { kind: "role" | "suspend" | "reactivate" | "remove" | "transfer"; member: OrganizationMemberResponse } | null;

function Members({ orgId, perms }: { orgId: string; perms: ReturnType<typeof useOrgPermissions> }) {
  const { user } = useAuth();
  const members = useQuery({ queryKey: orgKeys.members(orgId), queryFn: ({ signal }) => organizationsService.members(orgId, signal) });
  const [action, setAction] = React.useState<Action>(null);
  const list = members.data ?? [];
  const activeOwners = list.filter((m) => m.isOwner && m.membershipStatus.toUpperCase() === "ACTIVE").length;
  const canManage = perms.has(ORG_PERMS.MEMBERS_MANAGE);
  const canRemove = perms.has(ORG_PERMS.MEMBERS_REMOVE);
  const iAmOwner = !!perms.data?.isOwner;

  if (members.isLoading) return <Skeleton className="h-32 w-full" />;
  if (members.error) return <ErrorState error={members.error} onRetry={() => void members.refetch()} title="Couldn't load members" />;
  if (!list.length) return <EmptyState title="No members yet" />;
  return (
    <>
      <div className="mb-2 flex justify-end">
        <RefreshButton onClick={() => void members.refetch()} spinning={members.isFetching} />
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Members">
        {list.map((m) => {
          const status = m.membershipStatus.toUpperCase();
          const me = m.userId === user?.userId;
          const lastOwner = m.isOwner && activeOwners <= 1;
          const actionable = hasMemberId(m.memberId) && !me;
          const blocked = lastOwner ? LAST_OWNER : !hasMemberId(m.memberId) ? "This member can't be changed right now (missing member id from the server)." : undefined;
          return (
            <li key={`${m.userId}-${m.memberId}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{m.displayName || m.email}</p>
                  {me && <Badge tone="neutral">You</Badge>}
                  {m.isOwner && (
                    <Badge tone="primary">
                      <CrownIcon className="size-3" aria-hidden /> Owner
                    </Badge>
                  )}
                  {!m.isOwner && <Badge tone="neutral">{m.roleCode}</Badge>}
                  <StatusBadge value={status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.email} · Joined {formatDate(m.joinedAtUtc)}
                </p>
              </div>
              {(canManage || canRemove || iAmOwner) && !me && (
                <div className="flex flex-wrap gap-1.5">
                  {canManage && <MemberButton label="Change role" disabled={!actionable || lastOwner} why={blocked} onClick={() => setAction({ kind: "role", member: m })} />}
                  {canManage && status === "ACTIVE" && <MemberButton label="Suspend" disabled={!actionable || lastOwner} why={blocked} onClick={() => setAction({ kind: "suspend", member: m })} />}
                  {canManage && status === "SUSPENDED" && <MemberButton label="Reactivate" disabled={!actionable} why={blocked} onClick={() => setAction({ kind: "reactivate", member: m })} />}
                  {canRemove && <MemberButton label="Remove" tone="danger" disabled={!actionable || lastOwner} why={blocked} onClick={() => setAction({ kind: "remove", member: m })} />}
                  {iAmOwner && !m.isOwner && status === "ACTIVE" && (
                    <MemberButton label="Make owner" disabled={!hasMemberId(m.memberId)} why={blocked} onClick={() => setAction({ kind: "transfer", member: m })} />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <MemberActionDialogs orgId={orgId} action={action} onClose={() => setAction(null)} />
    </>
  );
}

function MemberButton({ label, onClick, disabled, why, tone }: { label: string; onClick: () => void; disabled?: boolean; why?: string; tone?: "danger" }) {
  const btn = (
    <Button size="sm" variant={tone === "danger" ? "danger-ghost" : "secondary"} onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
  return disabled && why ? (
    <Tooltip content={why}>
      <span tabIndex={0}>{btn}</span>
    </Tooltip>
  ) : (
    btn
  );
}

function MemberActionDialogs({ orgId, action, onClose }: { orgId: string; action: Action; onClose: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = React.useState<OrganizationRoleCode>("Staff");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setError(null);
    setReason("");
    if (action?.kind === "role") setRole((INVITABLE_ROLES.includes(action.member.roleCode as OrganizationRoleCode) ? action.member.roleCode : "Staff") as OrganizationRoleCode);
  }, [action]);
  const m = action?.member;
  const run = useApiMutation({
    toastOnError: false,
    mutationFn: async () => {
      if (!action || !m) return;
      const rv = m.rowVersion || null;
      if (action.kind === "role") await organizationsService.updateRole(orgId, m.memberId, { roleCode: role, expectedRowVersion: rv });
      if (action.kind === "suspend") await organizationsService.suspend(orgId, m.memberId, { reason: reason.trim() || null, expectedRowVersion: rv });
      if (action.kind === "reactivate") await organizationsService.reactivate(orgId, m.memberId, { expectedRowVersion: rv });
      if (action.kind === "remove") await organizationsService.remove(orgId, m.memberId, rv);
      if (action.kind === "transfer") await organizationsService.transferOwnership(orgId, { newOwnerMemberId: m.memberId, expectedRowVersion: null });
    },
    onSuccess: () => {
      toast.success(
        action?.kind === "transfer" ? `${m?.displayName || m?.email} is now the owner.` : action?.kind === "remove" ? "Member removed." : action?.kind === "role" ? "Role updated." : "Member updated.",
      );
      void qc.invalidateQueries({ queryKey: orgKeys.all(orgId) });
      onClose();
    },
  });
  const go = () => {
    setError(null);
    run.mutate(undefined, { onError: (e) => setError(orgErrorMessage(e)) });
  };
  const name = m?.displayName || m?.email || "this member";
  if (action?.kind === "role")
    return (
      <Dialog open onOpenChange={(o) => !o && !run.isPending && onClose()}>
        <DialogContent
          size="sm"
          title="Change role"
          description={name}
          footer={
            <>
              <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
                Cancel
              </Button>
              <Button onClick={go} loading={run.isPending}>
                Save role
              </Button>
            </>
          }
        >
          <FormError message={error} />
          <FormField label="Role" htmlFor="member-role">
            <NativeSelect id="member-role" value={role} onChange={(e) => setRole(e.target.value as OrganizationRoleCode)}>
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </DialogContent>
      </Dialog>
    );
  const copy = {
    suspend: { title: "Suspend member?", body: `${name} won't be able to work on this company until reactivated.`, label: "Suspend", tone: "danger" as const },
    reactivate: { title: "Reactivate member?", body: `${name} gets their previous access back.`, label: "Reactivate", tone: "primary" as const },
    remove: { title: "Remove member?", body: `${name} will lose access to this company.`, label: "Remove", tone: "danger" as const },
    transfer: { title: "Transfer ownership?", body: `${name} becomes the owner of this company and your role changes. This can't be undone by you.`, label: "Transfer ownership", tone: "danger" as const },
  };
  const c = action ? copy[action.kind as keyof typeof copy] : null;
  return (
    <ConfirmDialog
      open={!!c}
      onOpenChange={(o) => !o && !run.isPending && onClose()}
      title={c?.title ?? ""}
      description={c?.body}
      confirmLabel={c?.label}
      tone={c?.tone}
      loading={run.isPending}
      onConfirm={go}
    >
      <FormError message={error} />
      {action?.kind === "suspend" && (
        <FormField label="Reason (optional)" htmlFor="suspend-reason">
          <Textarea id="suspend-reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </FormField>
      )}
    </ConfirmDialog>
  );
}

function Invitations({ orgId, canInvite }: { orgId: string; canInvite: boolean }) {
  const qc = useQueryClient();
  const invitations = useQuery({ queryKey: orgKeys.invitations(orgId), queryFn: ({ signal }) => organizationsService.invitations(orgId, signal) });
  const [revoking, setRevoking] = React.useState<string | null>(null);
  const resend = useApiMutation({
    mutationFn: (id: string) => organizationsService.resendInvitation(orgId, id),
    successMessage: "Invitation sent again.",
    invalidate: [orgKeys.invitations(orgId)],
  });
  const revoke = useApiMutation({
    toastOnError: false,
    mutationFn: (id: string) => organizationsService.revokeInvitation(orgId, id, { reason: null }),
    successMessage: "Invitation cancelled.",
    onSuccess: () => {
      setRevoking(null);
      void qc.invalidateQueries({ queryKey: orgKeys.invitations(orgId) });
    },
  });
  if (invitations.isLoading) return <Skeleton className="h-24 w-full" />;
  if (invitations.error) return <ErrorState error={invitations.error} onRetry={() => void invitations.refetch()} title="Couldn't load invitations" />;
  const list = [...(invitations.data ?? [])].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
  if (!list.length) return <EmptyState icon={<EnvelopeSimpleIcon />} title="No invitations" description="Invite colleagues to help manage listings and orders." />;
  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border" aria-label="Invitations">
        {list.map((i) => {
          const open = ["INVITED", "PENDING"].includes(i.status.toUpperCase());
          return (
            <li key={i.invitationId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{i.email}</p>
                  <Badge tone="neutral">{i.roleCode}</Badge>
                  <StatusBadge value={i.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Sent {formatDateTime(i.createdAtUtc)} · Expires {formatDateTime(i.expiresAtUtc)}
                  {i.resentCount ? ` · Resent ${i.resentCount}×` : ""}
                </p>
              </div>
              {canInvite && open && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => resend.mutate(i.invitationId)} loading={resend.isPending && resend.variables === i.invitationId}>
                    <ArrowsClockwiseIcon /> Resend
                  </Button>
                  <Button size="sm" variant="danger-ghost" onClick={() => setRevoking(i.invitationId)}>
                    <XIcon /> Cancel
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="Cancel invitation?"
        description="The link in the email will stop working."
        confirmLabel="Cancel invitation"
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking, { onError: (e) => toast.error(orgErrorMessage(e)) })}
      />
    </>
  );
}

function InviteDialog({ orgId, open, onOpenChange }: { orgId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<OrganizationRoleCode>("Staff");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setEmail("");
      setRole("Staff");
      setError(null);
    }
  }, [open]);
  const invite = useApiMutation({
    toastOnError: false,
    mutationFn: () => organizationsService.invite(orgId, { email: email.trim(), roleCode: role }),
    successMessage: "Invitation sent.",
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgKeys.invitations(orgId) });
      onOpenChange(false);
    },
  });
  const submit = () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    invite.mutate(undefined, { onError: (e) => setError(orgErrorMessage(e)) });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !invite.isPending && onOpenChange(o)}>
      <DialogContent
        size="sm"
        title="Invite member"
        description="They'll get an email with a link to join this company."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={invite.isPending}>
              Cancel
            </Button>
            <Button onClick={submit} loading={invite.isPending}>
              <PaperPlaneTiltIcon /> Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormError message={error} />
          <FormField label="Email" htmlFor="invite-email" required>
            <Input id="invite-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Role" htmlFor="invite-role" required hint="Owner can only be given by transferring ownership.">
            <NativeSelect id="invite-role" value={role} onChange={(e) => setRole(e.target.value as OrganizationRoleCode)}>
              {INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}
