import { Link } from "react-router";
import { CompassIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/features/search/components/search-box";

export default function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:py-24">
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-action-soft ring-1 ring-action-border/30">
        <CompassIcon className="size-8 text-foreground" />
      </div>
      <p className="text-eyebrow font-semibold uppercase tracking-[0.18em] text-muted-foreground">Error 404</p>
      <h1 className="mt-2 font-heading text-[32px] font-bold leading-10 text-foreground">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">The page you're looking for doesn't exist or may have moved. Try a search instead:</p>
      <SearchBox variant="header" className="mt-6 w-full [&>div]:h-11" />
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
        <Button asChild variant="secondary" className="rounded-full">
          <Link to="/categories">Browse categories</Link>
        </Button>
      </div>
    </div>
  );
}
