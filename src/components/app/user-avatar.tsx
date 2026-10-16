"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { initials, resolveAvatarUrl } from "@/lib/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserAvatar({
  path,
  name,
  size = 40,
  online,
  className = "",
}: {
  path?: string | null;
  name?: string | null;
  size?: number;
  online?: boolean;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    resolveAvatarUrl(createClient(), path).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [path]);

  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={className} style={{ width: size, height: size }}>
        {url ? <AvatarImage src={url} alt={name ?? "Family member"} /> : null}
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {online ? (
        <span
          aria-label="Online"
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-success"
        />
      ) : null}
    </span>
  );
}
