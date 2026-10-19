"use client";

import { useMemo } from "react";
import {
  LUDO_SQUARE_VIEWBOX,
  LUDO_SQUARE_CELL,
  LUDO_SQUARE_TRACK_CELLS,
  ludoSquareRingPoint,
  ludoSquareColumnPoint,
  ludoSquareYardPoint,
  ludoSquareFinishPoint,
  ludoSeatHex,
  ludoStackOffset,
  type Point,
} from "@/lib/ludo";
import type { LudoSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

type LudoSquareBoardProps = {
  snapshot: LudoSnapshot;
  selectable?: number[];
  mySeat: number | null;
  onPickToken?: (token: number) => void;
  busy?: boolean;
};

type PlacedToken = {
  seat: number;
  token: number;
  point: Point;
  stackIndex: number;
  stackSize: number;
};

function Star({
  cx,
  cy,
  r,
  fill,
  stroke = "none",
  strokeWidth = 1,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * 36 - 90) * (Math.PI / 180);
    const radius = i % 2 === 0 ? r : r * 0.42;
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return (
    <polygon
      points={points.join(" ")}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

export function LudoSquareBoard({
  snapshot,
  selectable = [],
  mySeat,
  onPickToken,
  busy = false,
}: LudoSquareBoardProps) {
  const tokens = useMemo(() => snapshot.state.tokens ?? [], [snapshot.state.tokens]);
  const finishedOrder = useMemo(
    () => snapshot.state.finishedOrder ?? [],
    [snapshot.state.finishedOrder],
  );

  const radius = 30; // Token display radius on 100px cell

  // Group tokens by square point so multiple tokens on the same square fan out cleanly
  const placed = useMemo(() => {
    const buckets = new Map<string, PlacedToken[]>();

    for (const seatState of tokens) {
      const seat = seatState.seat;
      seatState.progress.forEach((progress, token) => {
        let point: Point | null = null;
        if (progress < 0) {
          // In yard
          point = ludoSquareYardPoint(seat, token);
        } else if (progress === 57) {
          // In home finish triangle
          point = ludoSquareFinishPoint(seat, token);
        } else if (progress >= 52) {
          // In home column (52..56)
          point = ludoSquareColumnPoint(seat, progress - 52);
        } else {
          // On outer ring (0..51)
          const abs = (seat * 13 + progress) % 52;
          point = ludoSquareRingPoint(abs);
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
  }, [tokens]);

  const redHex = ludoSeatHex(0);
  const greenHex = ludoSeatHex(1);
  const yellowHex = ludoSeatHex(2);
  const blueHex = ludoSeatHex(3);

  return (
    <svg
      viewBox={`0 0 ${LUDO_SQUARE_VIEWBOX} ${LUDO_SQUARE_VIEWBOX}`}
      className={cn(
        "mx-auto aspect-square h-auto w-full max-w-[min(94vw,560px)] touch-manipulation select-none drop-shadow-md",
        busy && "opacity-60",
      )}
      aria-label="Classic 4-Player Ludo Board"
    >
      {/* Outer wooden border / frame */}
      <rect
        x="0"
        y="0"
        width={LUDO_SQUARE_VIEWBOX}
        height={LUDO_SQUARE_VIEWBOX}
        fill="#5a4233"
        rx="24"
      />
      {/* Inner board base */}
      <rect
        x="30"
        y="30"
        width={LUDO_SQUARE_VIEWBOX - 60}
        height={LUDO_SQUARE_VIEWBOX - 60}
        fill="#FFFDF9"
        rx="12"
      />

      {/* ---------------- 4 CORNER YARDS (6x6 cells = 600x600 each) ---------------- */}
      {/* 1. Red Yard (Top-Left) */}
      <g>
        <rect x="30" y="30" width="570" height="570" fill={redHex} rx="12" />
        <rect
          x="100"
          y="100"
          width="430"
          height="430"
          fill="#FFFFFF"
          stroke="#1F2937"
          strokeWidth="4"
          rx="18"
        />
        {/* Central decorative star */}
        <Star cx={315} cy={315} r={70} fill={redHex} />
        {/* 4 Yard token circles */}
        {[
          { cx: 180, cy: 180 },
          { cx: 420, cy: 180 },
          { cx: 180, cy: 420 },
          { cx: 420, cy: 420 },
        ].map((c, i) => (
          <g key={`red-yard-${i}`}>
            <circle
              cx={c.cx}
              cy={c.cy}
              r={46}
              fill="#FFFFFF"
              stroke={redHex}
              strokeWidth="6"
            />
            <Star cx={c.cx} cy={c.cy} r={28} fill={redHex} />
          </g>
        ))}
      </g>

      {/* 2. Green Yard (Top-Right) */}
      <g>
        <rect x="900" y="30" width="570" height="570" fill={greenHex} rx="12" />
        <rect
          x="970"
          y="100"
          width="430"
          height="430"
          fill="#FFFFFF"
          stroke="#1F2937"
          strokeWidth="4"
          rx="18"
        />
        <Star cx={1185} cy={315} r={70} fill={greenHex} />
        {[
          { cx: 1080, cy: 180 },
          { cx: 1320, cy: 180 },
          { cx: 1080, cy: 420 },
          { cx: 1320, cy: 420 },
        ].map((c, i) => (
          <g key={`green-yard-${i}`}>
            <circle
              cx={c.cx}
              cy={c.cy}
              r={46}
              fill="#FFFFFF"
              stroke={greenHex}
              strokeWidth="6"
            />
            <Star cx={c.cx} cy={c.cy} r={28} fill={greenHex} />
          </g>
        ))}
      </g>

      {/* 3. Yellow Yard (Bottom-Right) */}
      <g>
        <rect x="900" y="900" width="570" height="570" fill={yellowHex} rx="12" />
        <rect
          x="970"
          y="970"
          width="430"
          height="430"
          fill="#FFFFFF"
          stroke="#1F2937"
          strokeWidth="4"
          rx="18"
        />
        <Star cx={1185} cy={1185} r={70} fill={yellowHex} />
        {[
          { cx: 1080, cy: 1080 },
          { cx: 1320, cy: 1080 },
          { cx: 1080, cy: 1320 },
          { cx: 1320, cy: 1320 },
        ].map((c, i) => (
          <g key={`yellow-yard-${i}`}>
            <circle
              cx={c.cx}
              cy={c.cy}
              r={46}
              fill="#FFFFFF"
              stroke={yellowHex}
              strokeWidth="6"
            />
            <Star cx={c.cx} cy={c.cy} r={28} fill={yellowHex} />
          </g>
        ))}
      </g>

      {/* 4. Blue Yard (Bottom-Left) */}
      <g>
        <rect x="30" y="900" width="570" height="570" fill={blueHex} rx="12" />
        <rect
          x="100"
          y="970"
          width="430"
          height="430"
          fill="#FFFFFF"
          stroke="#1F2937"
          strokeWidth="4"
          rx="18"
        />
        <Star cx={315} cy={1185} r={70} fill={blueHex} />
        {[
          { cx: 180, cy: 1080 },
          { cx: 420, cy: 1080 },
          { cx: 180, cy: 1320 },
          { cx: 420, cy: 1320 },
        ].map((c, i) => (
          <g key={`blue-yard-${i}`}>
            <circle
              cx={c.cx}
              cy={c.cy}
              r={46}
              fill="#FFFFFF"
              stroke={blueHex}
              strokeWidth="6"
            />
            <Star cx={c.cx} cy={c.cy} r={28} fill={blueHex} />
          </g>
        ))}
      </g>

      {/* ---------------- 52 TRACK CELLS ---------------- */}
      {LUDO_SQUARE_TRACK_CELLS.map(([col, row], index) => {
        const x = col * LUDO_SQUARE_CELL;
        const y = row * LUDO_SQUARE_CELL;
        const cx = x + 50;
        const cy = y + 50;

        // Start squares
        const isRedStart = index === 0;
        const isGreenStart = index === 13;
        const isYellowStart = index === 26;
        const isBlueStart = index === 39;

        // Other safe squares (stars)
        const isGreenSafe = index === 8;
        const isYellowSafe = index === 21;
        const isBlueSafe = index === 34;
        const isRedSafe = index === 47;

        let fill = "#FFFFFF";
        if (isRedStart) fill = redHex;
        else if (isGreenStart) fill = greenHex;
        else if (isYellowStart) fill = yellowHex;
        else if (isBlueStart) fill = blueHex;

        return (
          <g key={`track-cell-${index}`}>
            <rect
              x={x}
              y={y}
              width={LUDO_SQUARE_CELL}
              height={LUDO_SQUARE_CELL}
              fill={fill}
              stroke="#374151"
              strokeWidth="2"
            />

            {/* Start square white star */}
            {(isRedStart || isGreenStart || isYellowStart || isBlueStart) && (
              <Star cx={cx} cy={cy} r={26} fill="#FFFFFF" />
            )}

            {/* Safe square colored star on white background */}
            {isGreenSafe && <Star cx={cx} cy={cy} r={28} fill={greenHex} />}
            {isYellowSafe && <Star cx={cx} cy={cy} r={28} fill={yellowHex} />}
            {isBlueSafe && <Star cx={cx} cy={cy} r={28} fill={blueHex} />}
            {isRedSafe && <Star cx={cx} cy={cy} r={28} fill={redHex} />}
          </g>
        );
      })}

      {/* ---------------- DIRECTION ARROWS ON ENTRY ---------------- */}
      {/* Red arrow pointing right at [0, 6] */}
      <polygon points="25,625 25,675 75,650" fill={redHex} />
      {/* Green arrow pointing down at [7, 0] */}
      <polygon points="725,25 775,25 750,75" fill={greenHex} />
      {/* Yellow arrow pointing left at [14, 8] */}
      <polygon points="1475,825 1475,875 1425,850" fill={yellowHex} />
      {/* Blue arrow pointing up at [7, 14] */}
      <polygon points="725,1475 775,1475 750,1425" fill={blueHex} />

      {/* ---------------- HOME COLUMNS (5 cells each) ---------------- */}
      {/* Red Home Column (row 7, cols 1..5) */}
      {[1, 2, 3, 4, 5].map((col) => (
        <rect
          key={`home-red-${col}`}
          x={col * LUDO_SQUARE_CELL}
          y={7 * LUDO_SQUARE_CELL}
          width={LUDO_SQUARE_CELL}
          height={LUDO_SQUARE_CELL}
          fill={redHex}
          stroke="#374151"
          strokeWidth="2"
        />
      ))}

      {/* Green Home Column (col 7, rows 1..5) */}
      {[1, 2, 3, 4, 5].map((row) => (
        <rect
          key={`home-green-${row}`}
          x={7 * LUDO_SQUARE_CELL}
          y={row * LUDO_SQUARE_CELL}
          width={LUDO_SQUARE_CELL}
          height={LUDO_SQUARE_CELL}
          fill={greenHex}
          stroke="#374151"
          strokeWidth="2"
        />
      ))}

      {/* Yellow Home Column (row 7, cols 9..13) */}
      {[9, 10, 11, 12, 13].map((col) => (
        <rect
          key={`home-yellow-${col}`}
          x={col * LUDO_SQUARE_CELL}
          y={7 * LUDO_SQUARE_CELL}
          width={LUDO_SQUARE_CELL}
          height={LUDO_SQUARE_CELL}
          fill={yellowHex}
          stroke="#374151"
          strokeWidth="2"
        />
      ))}

      {/* Blue Home Column (col 7, rows 9..13) */}
      {[9, 10, 11, 12, 13].map((row) => (
        <rect
          key={`home-blue-${row}`}
          x={7 * LUDO_SQUARE_CELL}
          y={row * LUDO_SQUARE_CELL}
          width={LUDO_SQUARE_CELL}
          height={LUDO_SQUARE_CELL}
          fill={blueHex}
          stroke="#374151"
          strokeWidth="2"
        />
      ))}

      {/* ---------------- CENTER TRIANGLES (600..900 x 600..900) ---------------- */}
      {/* Red Left Triangle */}
      <polygon
        points="600,600 750,750 600,900"
        fill={redHex}
        stroke="#1F2937"
        strokeWidth="3"
      />
      {/* Green Top Triangle */}
      <polygon
        points="600,600 900,600 750,750"
        fill={greenHex}
        stroke="#1F2937"
        strokeWidth="3"
      />
      {/* Yellow Right Triangle */}
      <polygon
        points="900,600 900,900 750,750"
        fill={yellowHex}
        stroke="#1F2937"
        strokeWidth="3"
      />
      {/* Blue Bottom Triangle */}
      <polygon
        points="600,900 900,900 750,750"
        fill={blueHex}
        stroke="#1F2937"
        strokeWidth="3"
      />

      {/* Center Border Frame */}
      <rect
        x="600"
        y="600"
        width="300"
        height="300"
        fill="none"
        stroke="#1F2937"
        strokeWidth="3"
      />

      {/* ---------------- TOKENS ---------------- */}
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
            key={`sq-token-${entry.seat}-${entry.token}`}
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
            {/* Animated pulsing highlight ring for movable tokens */}
            {canPick && (
              <circle
                cx={x}
                cy={y}
                r={radius * 1.55}
                className="fill-transparent stroke-foreground"
                strokeWidth={4}
                strokeDasharray="6 4"
              >
                <animate
                  attributeName="stroke-opacity"
                  values="0.3;1;0.3"
                  dur="1.3s"
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {/* Token shadow / base */}
            <circle
              cx={x}
              cy={y + 3}
              r={radius}
              fill="rgba(0,0,0,0.35)"
            />

            {/* Token piece */}
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={hex}
              stroke="#FFFFFF"
              strokeWidth="3.5"
            />

            {/* Inner glossy accent */}
            <circle
              cx={x}
              cy={y - 5}
              r={radius * 0.65}
              fill="rgba(255,255,255,0.25)"
            />

            {/* Token number */}
            <text
              x={x}
              y={y + radius * 0.38}
              textAnchor="middle"
              className="fill-white text-[18px] font-bold"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
              aria-hidden
            >
              {entry.token + 1}
            </text>

            {/* Last moved token indicator */}
            {isLast && (
              <circle
                cx={x}
                cy={y}
                r={radius * 1.25}
                className="fill-transparent stroke-foreground"
                strokeWidth={3}
              />
            )}

            {/* Placement banner when finished */}
            {placed_ >= 0 && (
              <text
                x={x}
                y={y - radius * 1.3}
                textAnchor="middle"
                className="fill-foreground text-[16px] font-extrabold"
                aria-hidden
              >
                #{placed_ + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

