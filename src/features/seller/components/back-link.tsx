import { Link } from "react-router";
import { ArrowLeftIcon } from "@phosphor-icons/react";

/** Small "← Listings" breadcrumb shown above a seller page header. */
export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="mb-3 inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground sm:ml-3"
    >
      <ArrowLeftIcon className="size-4" aria-hidden /> {children}
    </Link>
  );
}
