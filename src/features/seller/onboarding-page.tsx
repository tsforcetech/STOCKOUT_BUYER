import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { ArrowRightIcon, StorefrontIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { ErrorState } from "@/components/feedback/states";
import { FullScreenLoader } from "@/lib/auth/guards";
import { useAuth } from "@/lib/auth/auth-context";
import { useSellerMode } from "@/lib/seller/seller-context";
import { humanize } from "@/lib/utils/format";
import type { MarketplaceSellerDto } from "@/api/types/user-organization";
import { CreateSellerForm } from "./components/create-seller-form";
import { OnboardingSteps } from "./components/onboarding-steps";

export default function SellerOnboardingPage() {
  const { actor, actorError, reloadActor, status } = useAuth();
  const { setActiveSellerId } = useSellerMode();
  const navigate = useNavigate();
  const contexts = actor?.sellerContexts ?? [];
  const hasIndividual = contexts.some((c) => c.sellerType === "INDIVIDUAL");

  const open = (sellerId: string) => {
    setActiveSellerId(sellerId);
    navigate("/seller");
  };

  const onCreated = async (seller: MarketplaceSellerDto) => {
    const existed = contexts.some((c) => c.sellerId === seller.sellerId);
    await reloadActor();
    setActiveSellerId(seller.sellerId);
    toast.success(existed ? "You already had this seller account — we opened it." : "Seller account created. Next, upload your verification documents.");
    navigate("/seller/business");
  };

  if (status === "initializing" || (!actor && !actorError)) return <FullScreenLoader />;

  return (
    <div className="bg-cream">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:py-16">
        <div>
          <p className="text-eyebrow mb-2 text-foreground">Sell on StockOut</p>
          <h1 className="font-heading text-[32px] font-bold leading-10 text-foreground sm:text-[44px] sm:leading-[52px]">Turn surplus stock into revenue</h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
            Set up your seller account in a few minutes. You can prepare listings while we verify your business.
          </p>
          <OnboardingSteps current={0} className="mt-8" />
        </div>

        <div className="space-y-6">
          {actorError && !actor ? (
            <div className="rounded-2xl bg-surface p-4 shadow-raised">
              <ErrorState error={actorError} title="We couldn't load your seller accounts" onRetry={() => void reloadActor()} />
            </div>
          ) : (
            contexts.length > 0 && (
              <section className="rounded-2xl bg-surface p-5 shadow-raised sm:p-6" aria-labelledby="existing-sellers">
                <h2 id="existing-sellers" className="font-heading text-xl font-bold text-foreground">
                  Your seller accounts
                </h2>
                <ul className="mt-4 divide-y divide-border">
                  {contexts.map((c) => (
                    <li key={c.sellerId} className="flex flex-wrap items-center gap-3 py-3">
                      <StorefrontIcon className="size-6 shrink-0" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{c.displayName || "Unnamed seller"}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                          <span>{humanize(c.sellerType)}</span>
                          <StatusBadge value={c.verificationStatus} />
                          {c.status !== "ACTIVE" && <StatusBadge value={c.status} />}
                          {!c.isOwner && <span>Member</span>}
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => open(c.sellerId)}>
                        Open portal <ArrowRightIcon />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          )}

          <section className="rounded-2xl bg-surface p-5 shadow-raised sm:p-6" aria-labelledby="create-seller">
            <h2 id="create-seller" className="font-heading text-2xl font-bold text-foreground">
              {contexts.length ? "Create another seller account" : "Create your seller account"}
            </h2>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">
              Step 1 of 3. You'll upload documents and submit for review next. Fields marked * are required.
            </p>
            <CreateSellerForm hasIndividual={hasIndividual} onCreated={onCreated} />
          </section>
          <p className="text-center text-xs text-muted-foreground">
            Just browsing? <Link to="/" className="underline underline-offset-4">Back to the marketplace</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
