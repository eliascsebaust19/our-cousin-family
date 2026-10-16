"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Dices, Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { LUDO_GAME_SELECT, channels } from "@/lib/queries";
import { createLudoGameSchema } from "@/lib/validation";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LUDO_BOARD_SEATS,
  ludoBoardLabel,
  ludoErrorMessage,
  ludoFriendlyError,
  ludoSeatHex,
} from "@/lib/ludo";
import type { LudoGameListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type LudoLobbyProps = {
  onOpen: (gameId: string) => void;
};

const TURN_CHOICES = [30, 60, 120] as const;

export function LudoLobby({ onOpen }: LudoLobbyProps) {
  const { activeFamily, userId } = useFamily();
  const familyId = activeFamily?.id ?? null;
  const [games, setGames] = useState<LudoGameListItem[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [boardSeats, setBoardSeats] = useState<number>(4);
  const [turnSeconds, setTurnSeconds] = useState<number>(60);

  const load = useCallback(async () => {
    if (!familyId) {
      setGames([]);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ludo_games")
      .select(LUDO_GAME_SELECT)
      .eq("family_id", familyId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      toast.error(`Could not load games: ${ludoErrorMessage(error)}`);
      return;
    }
    setGames((data ?? []) as unknown as LudoGameListItem[]);
  }, [familyId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: a new game, a seat filling up, or a status change refreshes the
  // list. Both tables are RLS-scoped, so only this family's rows arrive.
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 500);
    };

    const channel = supabase
      .channel(channels.ludoLobby(familyId ?? "none"))
      .on("postgres_changes", { event: "*", schema: "public", table: "ludo_games" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "ludo_seats" }, reload)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [familyId, load]);

  const createGame = async (event: FormEvent) => {
    event.preventDefault();
    if (!familyId) return;

    const parsed = createLudoGameSchema.safeParse({
      board_seats: boardSeats,
      turn_seconds: turnSeconds,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the game settings.");
      return;
    }

    setCreating(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("ludo_create_game", {
        p_family_id: familyId,
        p_board_seats: parsed.data.board_seats,
        p_turn_seconds: parsed.data.turn_seconds,
      });
      if (error) throw error;
      setDialogOpen(false);
      await load();
      if (data) onOpen(String(data));
    } catch (error) {
      const message = ludoErrorMessage(error);
      toast.error(
        message.includes("not_a_member")
          ? "You are not a member of this family."
          : `Could not create the game: ${ludoFriendlyError(message)}`,
      );
    } finally {
      setCreating(false);
    }
  };

  if (!activeFamily) {
    return (
      <div className="rounded-3xl border border-dashed p-6 text-center">
        <Dices className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Join or create a family first — Ludo is always played inside one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Family Ludo</h1>
          <p className="text-sm text-muted-foreground">
            {activeFamily.name} · server-rolled dice, so nobody can cheat
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="h-11 shrink-0 rounded-full">
          <Plus className="size-4" /> New game
        </Button>
      </div>

      {games === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-3xl" />
          <Skeleton className="h-24 w-full rounded-3xl" />
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-6 text-center">
          <Dices className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No games yet. Start one and the family can drop in.
          </p>
          <Button
            variant="outline"
            onClick={() => setDialogOpen(true)}
            className="mt-4 h-11 rounded-full"
          >
            <Plus className="size-4" /> New game
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {games.map((game) => {
            const filled = game.seats.length;
            const me = game.seats.some((seat) => seat.user_id === userId);
            return (
              <li key={game.id}>
                <button
                  type="button"
                  onClick={() => onOpen(game.id)}
                  className="flex w-full items-center gap-3 rounded-3xl border bg-card p-4 text-left transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted">
                    <Dices className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {ludoBoardLabel(game.board_seats)}
                      </span>
                      <StatusPill status={game.status} />
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <UserPlus className="size-3.5" aria-hidden />
                      {filled}/{game.board_seats} seats filled
                      {me ? " · you are in" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 -space-x-2">
                    {game.seats.slice(0, 4).map((seat) => (
                      <span
                        key={seat.id}
                        className="size-5 rounded-full border-2 border-card"
                        style={{ backgroundColor: ludoSeatHex(seat.seat) }}
                        title={seat.profile?.full_name ?? undefined}
                        aria-hidden
                      />
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New game</DialogTitle>
            <DialogDescription>
              The board size fixes the layout (arm and ring length) and the token
              count for everyone in this game.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={createGame} className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Players</legend>
              <div className="grid grid-cols-3 gap-2">
                {LUDO_BOARD_SEATS.map((seats) => (
                  <button
                    key={seats}
                    type="button"
                    onClick={() => setBoardSeats(seats)}
                    className={cn(
                      "h-16 rounded-2xl border text-center transition-colors",
                      boardSeats === seats
                        ? "border-foreground bg-muted font-medium"
                        : "border-border hover:border-foreground/40",
                    )}
                  >
                    <span className="block text-lg">{seats}</span>
                    <span className="block text-xs text-muted-foreground">
                      {seats === 8 ? "3 tokens" : "4 tokens"}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Seconds per turn</legend>
              <div className="grid grid-cols-3 gap-2">
                {TURN_CHOICES.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => setTurnSeconds(seconds)}
                    className={cn(
                      "h-11 rounded-full border text-sm transition-colors",
                      turnSeconds === seconds
                        ? "border-foreground bg-muted font-medium"
                        : "border-border hover:border-foreground/40",
                    )}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                If a clock runs out, the turn resolves itself automatically.
              </p>
            </fieldset>

            <DialogFooter className="gap-2 pt-1 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating} className="rounded-full">
                {creating ? <Loader2 className="size-4 animate-spin" /> : null}
                Create game
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
        status === "playing" && "border-emerald-500/50 text-emerald-600",
        status === "waiting" && "border-amber-500/50 text-amber-600",
        status !== "playing" && status !== "waiting" && "text-muted-foreground",
      )}
    >
      {status === "playing"
        ? "Playing"
        : status === "finished"
          ? "Finished"
          : status === "abandoned"
            ? "Abandoned"
            : "Waiting"}
    </span>
  );
}
