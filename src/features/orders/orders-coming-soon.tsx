import type * as React from "react";
import { ReceiptIcon } from "@phosphor-icons/react";

/**
 * Orders screens for buyers and sellers. The backend has no order/deal/payment API yet
 * (bidding-deal and subscription-payment expose only /system/version; the gateway's /api/v1/deals
 * route has no endpoints behind it), so these pages explain what is coming instead of showing data.
 */
export function OrdersComingSoon({ title, intro, features, action }: { title: string; intro: string; features: string[]; action?: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
      <div className="mt-5 rounded-2xl border border-border bg-surface p-8 text-center sm:p-12">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-cream">
          <ReceiptIcon className="size-7 text-foreground" />
        </span>
        <p className="mt-4 font-heading text-lg font-bold text-foreground">No orders yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-body">{intro}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
      <section className="mt-4 rounded-2xl border border-border bg-cream p-5">
        <p className="text-sm font-medium text-foreground">Coming with online ordering</p>
        <ul className="mt-2 grid gap-1.5 text-sm text-body sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-action-border" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
