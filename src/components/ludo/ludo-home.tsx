"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LudoGame } from "./ludo-game";
import { LudoLobby } from "./ludo-lobby";

/**
 * Chooses between the lobby and a single game based on `/ludo?game=<id>`.
 *
 * Keeping the id in the query string means a game can be linked to, survives a
 * refresh, and uses the same back-navigation the rest of the app does.
 */
export function LudoHome() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const gameId = searchParams.get("game");

  const open = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("game", id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const back = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("game");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  if (gameId) return <LudoGame gameId={gameId} onBack={back} />;
  return <LudoLobby onOpen={open} />;
}
