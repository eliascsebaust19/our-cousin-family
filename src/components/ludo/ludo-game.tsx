"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, Dices, Flag, Hourglass, LogOut, Play, Timer, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { LUDO_GAME_SELECT, channels } from "@/lib/queries";
import { useFamily } from "@/components/app/family-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LUDO_ERRORS,
  ludoErrorMessage as errorMessage,
  ludoFriendlyError as friendlyError,
  ludoProgressLabel,
  ludoSeatHex,
} from "@/lib/ludo";
import { LudoBoard } from "./ludo-board";
import type { LudoGameListItem, LudoSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

type LudoGameProps = {
  gameId: string;
  onBack: () => void;
};

export function LudoGame({ gameId, onBack }: LudoGameProps) {
  const { userId, roleInActiveFamily } = useFamily();
  const [game, setGame] = useState<LudoGameListItem | null>(null);
  const [snapshot, setSnapshot] = useState<LudoSnapshot | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // ---- data ----------------------------------------------------------------
  const load = useCallback(async () => {
    const supabase = createClient();
    const [row, snap] = await Promise.all([
      supabase
        .from("ludo_games")
        .select(LUDO_GAME_SELECT)
        .eq("id", gameId)
        .maybeSingle(),
      supabase.rpc("ludo_snapshot", { p_game_id: gameId }),
    ]);

    if (row.error || snap.error || !row.data || !snap.data) {
      const message = errorMessage(row.error ?? snap.error);
      if (!row.data && !snap.error) {
        setFailure("That game no longer exists.");
        return;
      }
      const key = Object.keys(LUDO_ERRORS).find((entry) => message.includes(entry));
      setFailure(key ? LUDO_ERRORS[key]! : "That game could not be opened.");
      return;
    }

    setFailure(null);
    setGame(row.data as unknown as LudoGameListItem);
    setSnapshot(snap.data as unknown as LudoSnapshot);
  }, [gameId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- realtime ------------------------------------------------------------
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 400);
    };

    const channel = supabase
      .channel(channels.ludoGame(gameId))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ludo_games", filter: `id=eq.${gameId}` },
        reload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ludo_seats", filter: `game_id=eq.${gameId}` },
        reload,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [gameId, load]);

  // ---- turn clock ----------------------------------------------------------
  const deadline = snapshot?.turnDeadline ?? null;
  useEffect(() => {
    if (!deadline) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [deadline]);

  const secondsLeft = useMemo(() => {
    if (!deadline) return null;
    return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
  }, [deadline, now]);
  const overdue = secondsLeft === 0;

  // ---- derived -------------------------------------------------------------
  const seats = useMemo(
    () => [...(game?.seats ?? [])].sort((a, b) => a.seat - b.seat),
    [game?.seats],
  );
  const mySeatRow = useMemo(
    () => seats.find((seat) => seat.user_id === userId) ?? null,
    [seats, userId],
  );
  const mySeat = mySeatRow?.seat ?? null;
  const isHost = game?.created_by === userId;
  const status = snapshot?.status ?? game?.status ?? "waiting";
  const phase = snapshot?.phase ?? "awaiting_roll";
  const isMyTurn =
    snapshot?.turnSeat != null && snapshot.turnSeat === mySeat && status === "playing";
  const legalMoves = snapshot?.legalMoves ?? [];
  /** True while this device may pick a token on the board. */
  const canAct = isMyTurn && phase === "awaiting_move" && !overdue;

  const turnLabel = useMemo(() => {
    if (!snapshot || snapshot.turnSeat == null) return null;
    const seat = seats.find((entry) => entry.seat === snapshot.turnSeat);
    return seat ? seat.profile?.full_name ?? `Seat ${snapshot.turnSeat + 1}` : null;
  }, [snapshot, seats]);

  // ---- actions -------------------------------------------------------------
  const handleFailure = useCallback(
    async (raw: unknown) => {
      const message = errorMessage(raw);
      if (message.includes("stale_state")) {
        setNotice("The board changed — catching up.");
        await load();
        return;
      }
      if (message.includes("turn_expired")) {
        setNotice("That turn clock ran out — resolving it.");
        const supabase = createClient();
        const { error } = await supabase.rpc("ludo_auto_resolve", { p_game_id: gameId });
        if (error) {
          toast.error(friendlyError(errorMessage(error)));
        } else {
          await load();
        }
        return;
      }
      toast.error(friendlyError(message));
    },
    [gameId, load],
  );

  const act = useCallback(
    async (work: () => Promise<unknown>) => {
      setBusy(true);
      setNotice(null);
      try {
        await work();
        await load();
      } catch (error) {
        await handleFailure(error);
      } finally {
        setBusy(false);
      }
    },
    [handleFailure, load],
  );

  const roll = () => {
    if (!snapshot) return;
    const version = snapshot.version;
    return act(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("ludo_roll", {
        p_game_id: gameId,
        p_expected_version: version,
      });
      if (error) throw error;
    });
  };

  const pickToken = (token: number) => {
    if (!snapshot) return;
    const version = snapshot.version;
    return act(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("ludo_move", {
        p_game_id: gameId,
        p_token: token,
        p_expected_version: version,
      });
      if (error) throw error;
    });
  };

  const pass = () => {
    if (!snapshot) return;
    const version = snapshot.version;
    return act(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("ludo_pass", {
        p_game_id: gameId,
        p_expected_version: version,
      });
      if (error) throw error;
    });
  };

  const resolveTurn = () =>
    act(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("ludo_auto_resolve", { p_game_id: gameId });
      if (error) throw error;
    });

  const join = () =>
    act(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("ludo_join_game", { p_game_id: gameId });
      if (error) throw error;
    });

  const start = () =>
    act(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("ludo_start_game", { p_game_id: gameId });
      if (error) throw error;
    });

  const toggleAutoplay = () => {
    if (!mySeatRow) return;
    const target = !mySeatRow.autoplay;
    return act(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("ludo_set_autoplay", {
        p_game_id: gameId,
        p_autoplay: target,
      });
      if (error) throw error;
      toast.success(target ? "Autoplay enabled" : "Autoplay disabled");
    });
  };

  const leave = () =>
    act(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("ludo_leave_game", { p_game_id: gameId });
      if (error) throw error;
      toast.success("You left the game.");
      onBack();
    });

  const deleteRoom = () =>
    act(async () => {
      if (!window.confirm("Are you sure you want to delete this game room?")) return;
      const supabase = createClient();
      const { error } = await supabase.rpc("ludo_delete_game", { p_game_id: gameId });
      if (error) throw error;
      toast.success("Game room deleted.");
      onBack();
    });

  // ---- views ---------------------------------------------------------------
  if (failure) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">{failure}</p>
        <Button variant="outline" onClick={onBack} className="rounded-full">
          <ArrowLeft className="size-4" /> Back to games
        </Button>
      </div>
    );
  }

  if (!game || !snapshot) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const canJoin =
    status === "waiting" && mySeat === null && seats.length < game.board_seats;
  const canStart = status === "waiting" && isHost && seats.length >= 2;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to games"
          className="shrink-0 rounded-full"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl">Family Ludo</h1>
          <p className="truncate text-xs text-muted-foreground">
            {game.board_seats} seats · {game.tokens_per_player} tokens each ·{" "}
            {game.turn_seconds}s per turn
          </p>
        </div>
        <StatusBadge status={status} />
        {(isHost || roleInActiveFamily === "owner" || roleInActiveFamily === "admin") && (
          <Button
            variant="ghost"
            size="icon"
            onClick={deleteRoom}
            disabled={busy}
            title="Delete game room"
            aria-label="Delete game room"
            className="size-9 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {notice ? (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </p>
      ) : null}

      {/* Action panel — kept above the board so it never needs scrolling */}
      <section className="space-y-3 rounded-3xl border bg-card p-4">
        {status === "waiting" ? (
          <>
            <p className="text-sm text-muted-foreground">
              {seats.length < 2
                ? "Waiting for at least one more player to join."
                : canStart
                  ? "Everyone's in. Start when you're ready."
                  : `${seats.length} of ${game.board_seats} seats filled. Waiting for the host to start.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {canJoin ? (
                <Button
                  onClick={join}
                  disabled={busy}
                  className="h-11 rounded-full"
                >
                  <Play className="size-4" /> Join this game
                </Button>
              ) : null}
              {canStart ? (
                <Button
                  onClick={start}
                  disabled={busy}
                  className="h-11 rounded-full"
                >
                  <Play className="size-4" /> Start game
                </Button>
              ) : null}
              {mySeat !== null ? (
                <>
                  <span className="inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: ludoSeatHex(mySeat) }}
                      aria-hidden
                    />
                    You are seat {mySeat + 1}
                  </span>
                  <Button
                    variant="outline"
                    onClick={leave}
                    disabled={busy}
                    className="h-11 rounded-full text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="mr-1.5 size-4" /> Leave game
                  </Button>
                </>
              ) : null}
            </div>
          </>
        ) : status === "finished" ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              <Trophy className="mr-1 inline size-4 text-amber-500" />
              {snapshot.winnerSeat != null
                ? `${
                    seats.find((entry) => entry.seat === snapshot.winnerSeat)?.profile
                      ?.full_name ?? `Seat ${snapshot.winnerSeat + 1}`
                  } won this game`
                : "Game over"}
            </p>
            <ol className="space-y-1 text-sm">
              {[...seats]
                .filter((entry) => entry.placement != null)
                .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
                .map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2">
                    <span className="w-6 text-center font-semibold">
                      #{entry.placement}
                    </span>
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: ludoSeatHex(entry.seat) }}
                      aria-hidden
                    />
                    <span className="truncate">
                      {entry.profile?.full_name ?? `Seat ${entry.seat + 1}`}
                      {entry.user_id === userId ? " (you)" : ""}
                    </span>
                  </li>
                ))}
            </ol>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={onBack} variant="outline" className="h-11 rounded-full">
                <ArrowLeft className="size-4" /> Back to games
              </Button>
              {(isHost || roleInActiveFamily === "owner" || roleInActiveFamily === "admin") && (
                <Button
                  onClick={deleteRoom}
                  variant="outline"
                  disabled={busy}
                  className="h-11 rounded-full text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4 mr-1.5" /> Delete room
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                {isMyTurn
                  ? phase === "awaiting_roll"
                    ? "Your turn — roll the dice."
                    : "Pick a token to move."
                  : `${turnLabel ?? "Another player"}'s turn`}
              </p>
              {secondsLeft !== null ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums",
                    overdue && "border-red-500/50 text-red-500",
                  )}
                  title="Time left on this turn"
                >
                  <Timer className="size-3.5" />
                  {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {isMyTurn && phase === "awaiting_roll" && !overdue ? (
                <Button
                  onClick={roll}
                  disabled={busy}
                  className="h-11 rounded-full"
                  aria-label="Roll the dice"
                >
                  <Dices className="size-4" /> Roll the dice
                </Button>
              ) : null}

              {isMyTurn && phase === "awaiting_move" ? (
                <>
                  <Button
                    disabled={busy || legalMoves.length === 0}
                    className="h-11 rounded-full"
                    aria-label="Skip this turn"
                    onClick={pass}
                    variant={legalMoves.length === 0 ? "default" : "outline"}
                  >
                    <Flag className="size-4" /> Skip turn
                  </Button>
                  {legalMoves.length === 0 ? (
                    <span className="inline-flex h-11 items-center px-2 text-xs text-muted-foreground">
                      No move is possible — skipping hands the turn over.
                    </span>
                  ) : null}
                </>
              ) : null}

              {overdue && status === "playing" ? (
                <Button
                  onClick={resolveTurn}
                  disabled={busy}
                  className="h-11 rounded-full"
                >
                  <Hourglass className="size-4" /> Resolve the timed-out turn
                </Button>
              ) : null}

              {!isMyTurn && status === "playing" && legalMoves.length > 0 && !overdue ? (
                <span className="inline-flex h-11 items-center px-1 text-xs text-muted-foreground">
                  {turnLabel ?? "They"} can move {legalMoves.length} token
                  {legalMoves.length === 1 ? "" : "s"}.
                </span>
              ) : null}

              {mySeatRow && status === "playing" ? (
                <Button
                  onClick={toggleAutoplay}
                  disabled={busy}
                  variant={mySeatRow.autoplay ? "secondary" : "outline"}
                  className="h-11 rounded-full text-xs"
                  title="Let the computer roll and move automatically for you"
                >
                  <Bot className="size-4" />
                  {mySeatRow.autoplay ? "Autoplay ON" : "Autoplay OFF"}
                </Button>
              ) : null}
            </div>

            {isMyTurn && phase === "awaiting_move" && legalMoves.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Tap the ringed {legalMoves.length === 1 ? "token" : "tokens"} on the
                board. {snapshot.dice !== null ? `You rolled ${snapshot.dice}.` : ""}
              </p>
            ) : null}
          </>
        )}
      </section>

      <LudoBoard
        snapshot={snapshot}
        mySeat={mySeat}
        busy={busy}
        selectable={canAct ? snapshot.legalMoves : []}
        onPickToken={canAct ? pickToken : undefined}
      />

      {/* Roster */}
      <section className="rounded-3xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Players {seats.length}/{game.board_seats}
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {Array.from({ length: game.board_seats }, (_, index) => {
            const seat = seats[index];
            const isTurn = snapshot.turnSeat === index && status === "playing";
            return (
              <li
                key={index}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-2xl border px-3 py-2",
                  seat ? "" : "border-dashed opacity-60",
                  isTurn && "border-foreground/40 bg-muted",
                )}
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: seat
                      ? ludoSeatHex(seat.seat)
                      : "var(--muted-foreground)",
                  }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {seat
                    ? `${seat.profile?.full_name ?? "Family member"}${
                        seat.user_id === userId ? " (you)" : ""
                      }`
                    : "Open seat"}
                </span>
                {seat?.placement != null ? (
                  <span className="shrink-0 text-xs font-semibold">
                    #{seat.placement}
                  </span>
                ) : seat?.autoplay ? (
                  <span className="shrink-0 text-xs text-muted-foreground">auto</span>
                ) : isTurn ? (
                  <span className="shrink-0 text-xs font-semibold">turn</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Last move summary — the audit trail the engine keeps */}
      {snapshot.state.lastMove ? (
        <p className="px-1 text-xs text-muted-foreground">
          Last move: seat {snapshot.state.lastMove.seat + 1} moved token{" "}
          {snapshot.state.lastMove.token + 1} from{" "}
          {ludoProgressLabel(game.board_seats, snapshot.state.lastMove.from)} to{" "}
          {ludoProgressLabel(game.board_seats, snapshot.state.lastMove.to)}
          {snapshot.state.lastMove.captured > 0
            ? ` and sent ${snapshot.state.lastMove.captured} token${
                snapshot.state.lastMove.captured === 1 ? "" : "s"
              } home`
            : ""}
          .
        </p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "playing"
      ? "In progress"
      : status === "finished"
        ? "Finished"
        : status === "abandoned"
          ? "Abandoned"
          : "Waiting";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
        status === "playing" && "border-emerald-500/50 text-emerald-600",
        status === "finished" && "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** Wraps the board so token picking is only wired up while a move is legal. */
