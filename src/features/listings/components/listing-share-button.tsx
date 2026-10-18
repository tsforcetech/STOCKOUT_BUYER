import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { LinkSimpleIcon, ShareNetworkIcon, WhatsappLogoIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";

function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

const triggerClass =
  "flex size-11 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface text-foreground transition-transform hover:border-foreground active:scale-90";

/** Share a listing: the OS share sheet when available, otherwise "Copy link" / "Share on WhatsApp". */
export function ListingShareButton({ title, url, className }: { title: string; url: string; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const native = canNativeShare();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
    setOpen(false);
  };

  if (native) {
    return (
      <button
        type="button"
        aria-label="Share listing"
        className={cn(triggerClass, className)}
        onClick={async () => {
          try {
            await navigator.share({ title, url });
          } catch (e) {
            if ((e as Error)?.name !== "AbortError") await copy();
          }
        }}
      >
        <ShareNetworkIcon className="size-5" />
      </button>
    );
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
  const item = "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-muted";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger aria-label="Share listing" className={cn(triggerClass, className)}>
        <ShareNetworkIcon className="size-5" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content align="end" sideOffset={8} collisionPadding={16} className="z-50 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-raised data-[state=open]:animate-[fade-in_120ms_ease-out]">
          <button type="button" onClick={copy} className={item}>
            <LinkSimpleIcon className="size-5" /> Copy link
          </button>
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={item}>
            <WhatsappLogoIcon className="size-5 text-[#25d366]" /> Share on WhatsApp
          </a>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
