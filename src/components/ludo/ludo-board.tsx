"use client";

import { useMemo } from "react";
import {
  LUDO_VIEWBOX,
  ludoCenterPoint,
  ludoColumnCells,
  ludoFinishLine,
  ludoRingCells,
  ludoRingLength,
  ludoSeatHex,
  ludoStackOffset,
  ludoTokenPositions,
  ludoTokenRadius,
  ludoTokensPerPlayer,
  ludoYardPoint,
  ludoArm,
  ludoRingAngle,
  type Point,
} from "@/lib/ludo";
import type { LudoSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

type LudoBoardProps = {
  snapshot: LudoSnapshot;
  /** Token indexes the player may move right now. */
  selectable?: number[];
  /** The seat currently being played by this device, if any. */
  mySeat: number | null;
  onPickToken?: (token: number) => void;
  /** Dim the board while a move is in flight. */
  busy?: boolean;
};

type PlacedToken = {
  seat: number;
  token: number;
  point: Point;
  stackIndex: number;
  stackSize: number;
};

/**
 * Renders the ring board for 4, 6 or 8 seats. Everything drawn here comes from
 * the server's snapshot; the component never infers rules.
 */
export function LudoBoard({
  snapshot,
  selectable = [],
  mySeat,
  onPickToken,
  busy = false,
}: LudoBoardProps) {
  const seats = snapshot.boardSeats;
  const radius = ludoTokenRadius(seats);
  const perPlayer = ludoTokensPerPlayer(seats);
  const finish = ludoFinishLine(seats);

  const ringCells = useMemo(() => ludoRingCells(seats), [seats]);
  const safeSquares = useMemo(
    () => new Set(snapshot.state.safeSquares ?? []),
    [snapshot.state.safeSquares],
  );
  const yardTokenPoints = useMemo(() => ludoTokenPositions(seats), [seats]);

  const tokens = useMemo(() => snapshot.state.tokens ?? [], [snapshot.state.tokens]);
  const finishedOrder = useMemo(
    () => snapshot.state.finishedOrder ?? [],
    [snapshot.state.finishedOrder],
  );

  const ringIndex = useMemo(
    () => new Map(ringCells.map((cell) => [cell.index, cell.point])),
    [ringCells],
  );
  const columnIndex = useMemo(
    () =>
      new Map(
        Array.from({ length: seats }, (_, seat) => [
          seat,
          ludoColumnCells(seats, seat).map((cell) => cell.point),
        ]),
      ),
    [seats],
  );

  // Group ring/column tokens by the square they occupy so stacks fan out.
  const placed = useMemo(() => {
    const ring = ludoRingLength(seats);
    const buckets = new Map<string, PlacedToken[]>();

    for (const seatState of tokens) {
      const seat = seatState.seat;
      seatState.progress.forEach((progress, token) => {
        let point: Point | null = null;
        if (progress < 0) {
          point = yardTokenPoints[seat]?.[token] ?? null;
        } else if (progress === finish) {
          const centre = ludoCenterPoint();
          point = {
            x: centre.x + (token - (perPlayer - 1) / 2) * (radius * 1.5),
            y: centre.y + (seat % 2 === 0 ? -radius * 0.9 : radius * 0.9),
          };
        } else if (progress >= ring) {
          point = columnIndex.get(seat)?.[progress - ring] ?? null;
        } else {
          const abs = (seat * ludoArm(seats) + progress) % ring;
          point = ringIndex.get(abs) ?? null;
        }
        if (!point) return;
        const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
        const list = buckets.get(key);
        const entry: PlacedToken = { seat, token, point, stackIndex: 0, stackSize: 1 };
        if (list) {
          list.push(entry);
        } else {
          buckets.set(key, [entry]);
        }
      });
    }

    const output: PlacedToken[] = [];
    for (const list of buckets.values()) {
      list.forEach((entry, index) => {
        output.push({ ...entry, stackIndex: index, stackSize: list.length });
      });
    }
    return output;
  }, [tokens, seats, perPlayer, radius, finish, yardTokenPoints, ringIndex, columnIndex]);

  const turnSeat = snapshot.turnSeat;

  return (
    <svg
      viewBox={`0 0 ${LUDO_VIEWBOX} ${LUDO_VIEWBOX}`}
      className={cn(
        "h-auto w-full touch-manipulation select-none",
        busy && "opacity-60",
      )}
      aria-label={`Ludo board for ${seats} players`}
    >
      <circle
        cx={LUDO_VIEWBOX / 2}
        cy={LUDO_VIEWBOX / 2}
        r={LUDO_VIEWBOX / 2 - 6}
        className="fill-card stroke-border"
        strokeWidth={3}
      />

      {/* Home columns */}
      {Array.from({ length: seats }, (_, seat) => {
        const hex = ludoSeatHex(seat);
        const cells = ludoColumnCells(seats, seat);
        const isMine = seat === mySeat;
        return (
          <g key={`column-${seat}`}>
            {cells.map((cell) => (
              <rect
                key={`column-${seat}-${cell.step}`}
                x={cell.point.x - radius * 1.15}
                y={cell.point.y - radius * 1.15}
                width={radius * 2.3}
                height={radius * 2.3}
                rx={6}
                fill={hex}
                fillOpacity={isMine ? 0.34 : 0.22}
                stroke={hex}
                strokeOpacity={0.7}
                strokeWidth={2}
                transform={`rotate(${cell.angle} ${cell.point.x} ${cell.point.y})`}
              />
            ))}
            {/* The finish slot, pointed at the centre */}
            <circle
              cx={cells[4]!.point.x + (LUDO_VIEWBOX / 2 - cells[4]!.point.x) * 0.46}
              cy={cells[4]!.point.y + (LUDO_VIEWBOX / 2 - cells[4]!.point.y) * 0.46}
              r={radius * 1.3}
              fill={hex}
              fillOpacity={0.5}
              stroke={hex}
              strokeWidth={2}
            />
          </g>
        );
      })}

      {/* Outer ring */}
      {ringCells.map((cell) => {
        const isSafe = safeSquares.has(cell.index) || cell.safe;
        const startHex =
          cell.startSeat !== null ? ludoSeatHex(cell.startSeat) : null;
        const mine = cell.startSeat !== null && cell.startSeat === mySeat;
        return (
          <rect
            key={`ring-${cell.index}`}
            x={cell.point.x - radius * 1.2}
            y={cell.point.y - radius * 1.2}
            width={radius * 2.4}
            height={radius * 2.4}
            rx={5}
            fill={startHex ?? (isSafe ? "#f5d9a0" : "transparent")}
            fillOpacity={startHex ? (mine ? 0.55 : 0.35) : isSafe ? 0.5 : 0}
            className={cn(!startHex && !isSafe && "fill-muted/40")}
            stroke={cell.startSeat !== null && cell.startSeat === turnSeat ? "#000" : "currentColor"}
            strokeOpacity={startHex || isSafe ? 0.6 : 0.25}
            strokeWidth={
              cell.startSeat !== null && cell.startSeat === turnSeat ? 3 : 1.6
            }
            transform={`rotate(${cell.angle} ${cell.point.x} ${cell.point.y})`}
          />
        );
      })}

      {/* Yards */}
      {yardTokenPoints.map((points, seat) => {
        const yard = ludoYardPoint(seats, seat);
        const hex = ludoSeatHex(seat);
        const angle = ludoRingAngle(seats, seat * ludoArm(seats));
        const isTurn = seat === turnSeat;
        return (
          <g key={`yard-${seat}`}>
            <rect
              x={yard.x - radius * 3.1}
              y={yard.y - radius * 2.4}
              width={radius * 6.2}
              height={radius * 4.8}
              rx={14}
              fill={hex}
              fillOpacity={seat === mySeat ? 0.22 : 0.13}
              stroke={hex}
              strokeOpacity={isTurn ? 0.95 : 0.45}
              strokeWidth={isTurn ? 4 : 2}
              transform={`rotate(${angle} ${yard.x} ${yard.y})`}
            />
            {points.map((point, index) => (
              <circle
                key={`yard-slot-${seat}-${index}`}
                cx={point.x}
                cy={point.y}
                r={radius * 0.8}
                fill="none"
                className="stroke-muted-foreground/40"
                strokeWidth={1.4}
                strokeDasharray="3 3"
              />
            ))}
          </g>
        );
      })}

      {/* Centre label */}
      <text
        x={LUDO_VIEWBOX / 2}
        y={LUDO_VIEWBOX / 2 + 5}
        textAnchor="middle"
        className="fill-muted-foreground font-display text-[26px]"
      >
        HOME
      </text>

      {/* Tokens */}
      {placed.map((entry) => {
        const hex = ludoSeatHex(entry.seat);
        const offset = ludoStackOffset(entry.stackSize, entry.stackIndex, radius);
        const canPick =
          onPickToken !== undefined &&
          entry.seat === mySeat &&
          selectable.includes(entry.token);
        const isLast =
          snapshot.state.lastMove?.seat === entry.seat &&
          snapshot.state.lastMove?.token === entry.token;
        const placed_ = finishedOrder.indexOf(entry.seat);
        const x = entry.point.x + offset.x;
        const y = entry.point.y + offset.y;
        return (
          <g
            key={`token-${entry.seat}-${entry.token}`}
            className={cn(canPick && "cursor-pointer")}
            onClick={canPick ? () => onPickToken?.(entry.token) : undefined}
            role={canPick ? "button" : undefined}
            aria-label={canPick ? `Move token ${entry.token + 1}` : undefined}
            tabIndex={canPick ? 0 : undefined}
            onKeyDown={
              canPick
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onPickToken?.(entry.token);
                    }
                  }
                : undefined
            }
          >
            {canPick ? (
              <circle
                cx={x}
                cy={y}
                r={radius * 1.65}
                className="fill-transparent stroke-foreground/80"
                strokeWidth={2.5}
                strokeDasharray="4 3"
              >
                <animate
                  attributeName="stroke-opacity"
                  values="0.35;1;0.35"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </circle>
            ) : null}
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={hex}
              stroke="white"
              strokeOpacity={0.85}
              strokeWidth={1.6}
            />
            <text
              x={x}
              y={y + radius * 0.38}
              textAnchor="middle"
              className="fill-white text-[11px] font-semibold"
              aria-hidden
            >
              {entry.token + 1}
            </text>
            {isLast ? (
              <circle
                cx={x}
                cy={y}
                r={radius * 1.2}
                className="fill-transparent stroke-foreground"
                strokeWidth={2}
              />
            ) : null}
            {placed_ >= 0 ? (
              <text
                x={x}
                y={y - radius * 1.4}
                textAnchor="middle"
                className="fill-foreground text-[13px] font-bold"
                aria-hidden
              >
                #{placed_ + 1}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
