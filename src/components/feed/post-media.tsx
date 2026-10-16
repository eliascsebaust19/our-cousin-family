"use client";

import { useEffect, useState } from "react";
import { ImageOff, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolveMediaUrl } from "@/lib/avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { PostMediaItem } from "@/lib/types";

function useMediaUrl(item: PostMediaItem) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    resolveMediaUrl(createClient(), item.storage_path, "post-media").then(
      (resolved) => {
        if (!active) return;
        if (resolved) setUrl(resolved);
        else setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [item.storage_path]);

  return { url, failed };
}

function MediaTile({
  item,
  onOpen,
  className = "",
}: {
  item: PostMediaItem;
  onOpen?: () => void;
  className?: string;
}) {
  const { url, failed } = useMediaUrl(item);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}
      >
        <ImageOff className="h-6 w-6" aria-hidden />
      </div>
    );
  }

  if (!url) {
    return <Skeleton className={`rounded-none ${className}`} />;
  }

  const isVideo = item.media_type === "video";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative overflow-hidden bg-muted ${className}`}
      aria-label={isVideo ? "Play video" : "Open photo"}
    >
      {isVideo ? (
        <>
          <video
            src={url}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-foreground shadow">
              <Play className="h-5 w-5" aria-hidden />
            </span>
          </span>
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Post attachment"
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
      )}
    </button>
  );
}

export function PostMediaGrid({ items }: { items: PostMediaItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sorted = [...items].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) return null;

  const single = sorted.length === 1;
  const active = openIndex !== null ? sorted[openIndex] : null;

  return (
    <>
      <div
        className={`mt-3 grid gap-1 overflow-hidden rounded-2xl ${
          single
            ? "grid-cols-1"
            : sorted.length === 2
              ? "grid-cols-2"
              : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        {sorted.map((item, index) => (
          <MediaTile
            key={item.id}
            item={item}
            onOpen={() => setOpenIndex(index)}
            className={
              single
                ? "aspect-[4/3] w-full"
                : `aspect-square w-full ${
                    sorted.length === 3 && index === 0 ? "col-span-2 sm:col-span-1" : ""
                  }`
            }
          />
        ))}
      </div>

      <Dialog
        open={openIndex !== null}
        onOpenChange={(open) => !open && setOpenIndex(null)}
      >
        <DialogContent className="max-w-lg border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Media preview</DialogTitle>
          {active ? <LightboxContent item={active} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function LightboxContent({ item }: { item: PostMediaItem }) {
  const { url } = useMediaUrl(item);
  if (!url) return <Skeleton className="aspect-[4/3] w-full rounded-2xl" />;

  if (item.media_type === "video") {
    return (
      <video
        src={url}
        controls
        autoPlay
        playsInline
        className="max-h-[80dvh] w-full rounded-2xl bg-black"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Post attachment"
      className="max-h-[80dvh] w-full rounded-2xl object-contain"
    />
  );
}
