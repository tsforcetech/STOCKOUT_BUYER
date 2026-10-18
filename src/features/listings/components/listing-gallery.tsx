import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { CameraIcon, CaretLeftIcon, CaretRightIcon, XIcon } from "@phosphor-icons/react";
import { ListingImage } from "@/components/common/listing-image";
import { cn } from "@/lib/utils/cn";

export interface GalleryImage {
  fileAssetId: string;
  cdnUrl: string;
}

const SWIPE_THRESHOLD = 48;

/** Horizontal swipe detection for touch devices (ignores mostly-vertical gestures so the page can still scroll). */
function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = React.useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      start.current = t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      const t = e.changedTouches[0];
      start.current = null;
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
      if (dx > 0) onPrev();
      else onNext();
    },
  };
}

function NavButton({ dir, onClick, className }: { dir: "prev" | "next"; onClick: () => void; className?: string }) {
  const Icon = dir === "prev" ? CaretLeftIcon : CaretRightIcon;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={dir === "prev" ? "Previous photo" : "Next photo"}
      className={cn("flex size-10 cursor-pointer items-center justify-center rounded-full shadow-raised transition-transform active:scale-90", className)}
    >
      <Icon className="size-5" weight="bold" />
    </button>
  );
}

/**
 * Listing photos: main image (click → full-screen viewer), photo-count chip, prev/next and a thumbnail strip.
 * Works with zero images (shows the ListingImage placeholder, no viewer).
 */
export function ListingGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [index, setIndex] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const count = images.length;
  const safeIndex = count ? Math.min(index, count - 1) : 0;
  const current = images[safeIndex];
  const prev = React.useCallback(() => setIndex((i) => (count ? (i - 1 + count) % count : 0)), [count]);
  const next = React.useCallback(() => setIndex((i) => (count ? (i + 1) % count : 0)), [count]);
  const swipe = useSwipe(prev, next);

  return (
    <div className="min-w-0">
      <div className="group relative overflow-hidden rounded-2xl bg-cream-strong" {...swipe}>
        {count > 0 ? (
          <button type="button" onClick={() => setOpen(true)} className="block w-full cursor-zoom-in" aria-label={`Open photo viewer, photo ${safeIndex + 1} of ${count}`}>
            <ListingImage src={current?.cdnUrl} alt={title} className="aspect-[4/3] w-full" />
          </button>
        ) : (
          <ListingImage src={null} alt={title} className="aspect-[4/3] w-full" />
        )}

        {count > 0 && (
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            <CameraIcon className="size-4" aria-hidden />
            {count}
            <span className="sr-only"> photos</span>
          </span>
        )}

        {count > 1 && (
          <>
            <NavButton dir="prev" onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 bg-surface/90 text-foreground opacity-100 hover:bg-surface sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" />
            <NavButton dir="next" onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 bg-surface/90 text-foreground opacity-100 hover:bg-surface sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100" />
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Photos">
          {images.map((img, i) => (
            <button
              key={img.fileAssetId}
              type="button"
              role="tab"
              aria-selected={i === safeIndex}
              aria-label={`Photo ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-opacity",
                i === safeIndex ? "border-foreground" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <ListingImage src={img.cdnUrl} alt="" className="size-16 sm:size-20" />
            </button>
          ))}
        </div>
      )}

      {count > 0 && <Lightbox open={open} onOpenChange={setOpen} images={images} index={safeIndex} setIndex={setIndex} prev={prev} next={next} title={title} />}
    </div>
  );
}

function Lightbox({
  open,
  onOpenChange,
  images,
  index,
  setIndex,
  prev,
  next,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: GalleryImage[];
  index: number;
  setIndex: (i: number) => void;
  prev: () => void;
  next: () => void;
  title: string;
}) {
  const count = images.length;
  const current = images[index];
  const swipe = useSwipe(prev, next);
  const stripRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const active = stripRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    active?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index, open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              prev();
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              next();
            }
          }}
          className="fixed inset-0 z-50 flex flex-col text-white focus:outline-none data-[state=open]:animate-[fade-in_150ms_ease-out]"
        >
          <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-medium tabular-nums" aria-live="polite">
                {index + 1} / {count}
              </span>
              <DialogPrimitive.Title className="truncate text-sm font-medium text-white/80">{title}</DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close photo viewer">
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
          </header>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20" {...swipe}>
            <ListingImage
              key={current?.fileAssetId}
              src={current?.cdnUrl}
              alt={`${title} — photo ${index + 1} of ${count}`}
              className="aspect-[4/3] max-h-full w-full max-w-[min(100%,calc((100dvh-200px)*4/3))] rounded-xl object-contain"
            />
            {count > 1 && (
              <>
                <NavButton dir="prev" onClick={prev} className="absolute left-2 top-1/2 hidden -translate-y-1/2 bg-white/15 text-white hover:bg-white/25 sm:left-6 sm:flex" />
                <NavButton dir="next" onClick={next} className="absolute right-2 top-1/2 hidden -translate-y-1/2 bg-white/15 text-white hover:bg-white/25 sm:right-6 sm:flex" />
              </>
            )}
          </div>

          {count > 1 && (
            <div className="flex items-center justify-center gap-4 px-4 pt-3 sm:hidden">
              <NavButton dir="prev" onClick={prev} className="bg-white/15 text-white" />
              <NavButton dir="next" onClick={next} className="bg-white/15 text-white" />
            </div>
          )}

          {count > 1 && (
            <div ref={stripRef} role="group" className="flex gap-2 overflow-x-auto px-4 py-4 sm:justify-center sm:px-6" aria-label="Photo thumbnails">
              {images.map((img, i) => (
                <button
                  key={img.fileAssetId}
                  type="button"
                  data-index={i}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "shrink-0 cursor-pointer overflow-hidden rounded-md border-2 transition-opacity",
                    i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-90",
                  )}
                >
                  <ListingImage src={img.cdnUrl} alt="" className="size-14 sm:size-16" />
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
