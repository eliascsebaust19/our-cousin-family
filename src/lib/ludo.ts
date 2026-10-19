/**
 * Board geometry for Family Ludo.
 *
 * IMPORTANT: this module is presentation-only. The authoritative rules — dice,
 * legality, blocks, captures, turn order — live in Postgres
 * (`supabase/migrations/20261016060000_ludo.sql`). Everything here exists so
 * the browser can *draw* the board and label positions; it never decides
 * anything. Where a value is also carried in `ludo_games.state` (for example
 * `safeSquares`) the components prefer the server's copy and use these helpers
 * only as a fallback.
 *
 * The dimensions below mirror docs/ludo-rules.md §3 exactly.
 */

export type LudoBoardSeats = 4 | 6 | 8;

export const LUDO_BOARD_SEATS: LudoBoardSeats[] = [4, 6, 8];

/** Squares between two adjacent seats on the outer ring. */
export function ludoArm(seats: number): number {
  return seats === 4 ? 13 : seats === 6 ? 9 : 7;
}

/** Total outer-ring squares (a regular S-gon). */
export function ludoRingLength(seats: number): number {
  return seats * ludoArm(seats);
}

/** `ring + 5`: the last home-column square is `finish - 1`, home is `finish`. */
export function ludoFinishLine(seats: number): number {
  return ludoRingLength(seats) + 5;
}

/** Offset of each seat's second starred square. */
export function ludoSafeOffset(seats: number): number {
  return seats === 4 ? 8 : seats === 6 ? 5 : 4;
}

/** Starred squares: every seat's start, plus one more a fixed offset along. */
export function ludoSafeSquares(seats: number): number[] {
  const set = new Set<number>();
  for (let seat = 0; seat < seats; seat += 1) {
    set.add(seat * ludoArm(seats));
    set.add(seat * ludoArm(seats) + ludoSafeOffset(seats));
  }
  return [...set].sort((a, b) => a - b);
}

/** 8-seat boards drop to three tokens so blocking stays playable (§3.1). */
export function ludoTokensPerPlayer(seats: number): number {
  return seats === 8 ? 3 : 4;
}

/** Absolute ring square for one seat's relative progress. */
export function ludoAbsSquare(seats: number, seat: number, progress: number): number {
  const ring = ludoRingLength(seats);
  return (((seat * ludoArm(seats) + progress) % ring) + ring) % ring;
}

export function ludoIsSafeSquare(seats: number, square: number): boolean {
  return ludoSafeSquares(seats).includes(square);
}

// ---------------------------------------------------------------------------
// Colours — one per seat, matching `public.ludo_seat_color(int)` in the engine
// ---------------------------------------------------------------------------

const SEAT_COLOR_NAMES = [
  "red",
  "green",
  "yellow",
  "blue",
  "purple",
  "orange",
  "teal",
  "pink",
] as const;

export type LudoColorName = (typeof SEAT_COLOR_NAMES)[number];

export function ludoSeatColorName(seat: number): LudoColorName {
  return SEAT_COLOR_NAMES[seat % SEAT_COLOR_NAMES.length]!;
}

/** Hex values tuned for the app's warm light + dark themes. */
export const LUDO_COLOR_HEX: Record<LudoColorName, string> = {
  red: "#DC2626",
  green: "#16A34A",
  yellow: "#CA8A04",
  blue: "#2563EB",
  purple: "#8b5cf6",
  orange: "#e0823a",
  teal: "#2f9d94",
  pink: "#d9649b",
};

export function ludoSeatHex(seat: number): string {
  return LUDO_COLOR_HEX[ludoSeatColorName(seat)];
}

// ---------------------------------------------------------------------------
// Classic 15x15 Square Board Layout (for 4 players)
// Matches authentic traditional Ludo boards
// ---------------------------------------------------------------------------
export const LUDO_SQUARE_VIEWBOX = 1500;
export const LUDO_SQUARE_CELL = 100;

export const LUDO_SQUARE_TRACK_CELLS: Array<[number, number]> = [
  // Arm 0 (Red start to Top Arm entrance)
  [1, 6],  // 0: Red Start Square (star)
  [2, 6],  // 1
  [3, 6],  // 2
  [4, 6],  // 3
  [5, 6],  // 4
  [6, 5],  // 5: Turn up
  [6, 4],  // 6
  [6, 3],  // 7
  [6, 2],  // 8: Safe Square (star)
  [6, 1],  // 9
  [6, 0],  // 10
  [7, 0],  // 11: Top edge center
  [8, 0],  // 12: Turn down

  // Arm 1 (Green start to Right Arm entrance)
  [8, 1],  // 13: Green Start Square (star)
  [8, 2],  // 14
  [8, 3],  // 15
  [8, 4],  // 16
  [8, 5],  // 17
  [9, 6],  // 18: Turn right
  [10, 6], // 19
  [11, 6], // 20
  [12, 6], // 21: Safe Square (star)
  [13, 6], // 22
  [14, 6], // 23
  [14, 7], // 24: Right edge center
  [14, 8], // 25: Turn left

  // Arm 2 (Yellow start to Bottom Arm entrance)
  [13, 8], // 26: Yellow Start Square (star)
  [12, 8], // 27
  [11, 8], // 28
  [10, 8], // 29
  [9, 8],  // 30
  [8, 9],  // 31: Turn down
  [8, 10], // 32
  [8, 11], // 33
  [8, 12], // 34: Safe Square (star)
  [8, 13], // 35
  [8, 14], // 36
  [7, 14], // 37: Bottom edge center
  [6, 14], // 38: Turn up

  // Arm 3 (Blue start to Left Arm entrance)
  [6, 13], // 39: Blue Start Square (star)
  [6, 12], // 40
  [6, 11], // 41
  [6, 10], // 42
  [6, 9],  // 43
  [5, 8],  // 44: Turn left
  [4, 8],  // 45
  [3, 8],  // 46
  [2, 8],  // 47: Safe Square (star)
  [1, 8],  // 48
  [0, 8],  // 49
  [0, 7],  // 50: Left edge center
  [0, 6],  // 51: Turn right to index 0
];

/** Return center coordinates {x, y} for ring index 0..51 on the classic square board */
export function ludoSquareRingPoint(index: number): Point {
  const [col, row] = LUDO_SQUARE_TRACK_CELLS[index % 52]!;
  return {
    x: col * LUDO_SQUARE_CELL + LUDO_SQUARE_CELL / 2,
    y: row * LUDO_SQUARE_CELL + LUDO_SQUARE_CELL / 2,
  };
}

/** Return center coordinates {x, y} for home column cell (step 0..4) for a seat */
export function ludoSquareColumnPoint(seat: number, step: number): Point {
  let col = 7;
  let row = 7;
  if (seat === 0) {
    col = 1 + step;
    row = 7;
  } else if (seat === 1) {
    col = 7;
    row = 1 + step;
  } else if (seat === 2) {
    col = 13 - step;
    row = 7;
  } else if (seat === 3) {
    col = 7;
    row = 13 - step;
  }
  return {
    x: col * LUDO_SQUARE_CELL + LUDO_SQUARE_CELL / 2,
    y: row * LUDO_SQUARE_CELL + LUDO_SQUARE_CELL / 2,
  };
}

/** Return yard token spots {x, y} for each seat on the classic square board */
export function ludoSquareYardPoint(seat: number, tokenIndex: number): Point {
  const offsets = [
    { dx: 180, dy: 180 },
    { dx: 420, dy: 180 },
    { dx: 180, dy: 420 },
    { dx: 420, dy: 420 },
  ];
  const offset = offsets[tokenIndex % 4]!;
  let originX = 0;
  let originY = 0;
  if (seat === 0) {
    originX = 0;
    originY = 0;
  } else if (seat === 1) {
    originX = 900;
    originY = 0;
  } else if (seat === 2) {
    originX = 900;
    originY = 900;
  } else if (seat === 3) {
    originX = 0;
    originY = 900;
  }
  return {
    x: originX + offset.dx,
    y: originY + offset.dy,
  };
}

/** Center finish apex points for finished tokens in the 4 triangles */
export function ludoSquareFinishPoint(seat: number, tokenIndex: number): Point {
  const center = 750;
  const spread = 24 * (tokenIndex - 1.5);
  if (seat === 0) {
    return { x: 675, y: center + spread };
  } else if (seat === 1) {
    return { x: center + spread, y: 675 };
  } else if (seat === 2) {
    return { x: 825, y: center + spread };
  } else {
    return { x: center + spread, y: 825 };
  }
}

// ---------------------------------------------------------------------------
// Rendering layout (SVG user units)
// ---------------------------------------------------------------------------

export const LUDO_VIEWBOX = 1000;
const CENTER = LUDO_VIEWBOX / 2;
const RING_RADIUS = 392;
const COLUMN_STEP = 47;
const YARD_RADIUS = 92;

export type Point = { x: number; y: number };

/** Angle (degrees) of ring square `index`, measured clockwise from the top. */
export function ludoRingAngle(seats: number, index: number): number {
  return (index / ludoRingLength(seats)) * 360;
}

function polar(angleDeg: number, radius: number): Point {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

export function ludoRingPoint(seats: number, index: number, radius = RING_RADIUS): Point {
  return polar(ludoRingAngle(seats, index), radius);
}

/** Side length of one ring cell, sized to the circumference without overlap. */
export function ludoRingCellSize(seats: number): number {
  const ring = ludoRingLength(seats);
  return Math.min(52, ((2 * Math.PI * RING_RADIUS) / ring) * 0.82);
}

/** Radius of a token drawn on the ring. */
export function ludoTokenRadius(seats: number): number {
  return Math.max(8.5, ludoRingCellSize(seats) * 0.32);
}

export type LudoRingCell = {
  index: number;
  point: Point;
  angle: number;
  /** Seat that starts here, if any. */
  startSeat: number | null;
  safe: boolean;
};

export type LudoColumnCell = {
  seat: number;
  step: number;
  point: Point;
  angle: number;
};

export function ludoRingCells(seats: number): LudoRingCell[] {
  const ring = ludoRingLength(seats);
  const safe = new Set(ludoSafeSquares(seats));
  const cells: LudoRingCell[] = [];
  for (let index = 0; index < ring; index += 1) {
    const startSeat =
      index % ludoArm(seats) === 0 ? index / ludoArm(seats) : null;
    cells.push({
      index,
      point: ludoRingPoint(seats, index),
      angle: ludoRingAngle(seats, index),
      startSeat,
      safe: safe.has(index),
    });
  }
  return cells;
}

/** The five private home-column squares of one seat, running inward. */
export function ludoColumnCells(seats: number, seat: number): LudoColumnCell[] {
  const angle = ludoRingAngle(seats, seat * ludoArm(seats));
  const cells: LudoColumnCell[] = [];
  for (let step = 0; step < 5; step += 1) {
    cells.push({
      seat,
      step,
      point: polar(angle, RING_RADIUS - (step + 1) * COLUMN_STEP),
      angle,
    });
  }
  return cells;
}

export function ludoCenterPoint(): Point {
  return { x: CENTER, y: CENTER };
}

/** Where a seat's yard sits, just outside the ring. */
export function ludoYardPoint(seats: number, seat: number): Point {
  return polar(ludoRingAngle(seats, seat * ludoArm(seats)), RING_RADIUS + YARD_RADIUS);
}

/** Screen position of every token belonging to `seat`. */
export function ludoTokenPositions(seats: number): Point[][] {
  const perPlayer = ludoTokensPerPlayer(seats);
  return Array.from({ length: seats }, (_, seat) => {
    const yard = ludoYardPoint(seats, seat);
    const spread = 26;
    return Array.from({ length: perPlayer }, (_, token) => {
      const col = token % 2;
      const row = Math.floor(token / 2);
      return {
        x: yard.x + (col === 0 ? -spread : spread) * 0.5,
        y: yard.y + (row === 0 ? -spread : spread) * 0.5,
      };
    });
  });
}

/**
 * Offsets so that several tokens standing on one square stay distinguishable.
 */
export function ludoStackOffset(count: number, index: number, radius: number): Point {
  if (count <= 1 || index === 0) return { x: 0, y: 0 };
  const spread = radius * 0.62;
  const ring = [
    { x: -spread, y: -spread * 0.6 },
    { x: spread, y: -spread * 0.6 },
    { x: -spread, y: spread * 0.6 },
    { x: spread, y: spread * 0.6 },
    { x: 0, y: -spread },
    { x: 0, y: spread },
  ];
  return ring[(index - 1) % ring.length]!;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function ludoProgressLabel(seats: number, progress: number): string {
  const ring = ludoRingLength(seats);
  const finish = ludoFinishLine(seats);
  if (progress < 0) return "Yard";
  if (progress === finish) return "Home";
  if (progress >= ring) return `Column ${progress - ring + 1}/5`;
  return `Ring ${progress + 1}/${ring}`;
}

/** Progress values that a given dice roll can reach, for the move hints. */
export function ludoDestination(progress: number, dice: number): number {
  return progress < 0 ? 0 : progress + dice;
}

export function ludoBoardLabel(seats: number): string {
  return `${seats} players · ${ludoTokensPerPlayer(seats)} tokens each`;
}

// ---------------------------------------------------------------------------
// Player-facing errors
//
// The engine raises bare SQLERRM strings (`stale_state`, `not_your_turn`, …).
// The two handled programmatically — `stale_state` and `turn_expired` — map to
// an empty string here so callers can tell them apart from shown messages.
// ---------------------------------------------------------------------------

export const LUDO_ERRORS: Record<string, string> = {
  not_authenticated: "Please sign in again to play.",
  not_a_member: "You are not a member of this family.",
  game_not_found: "That game no longer exists.",
  game_not_playing: "That game has finished.",
  wrong_phase: "The dice are already waiting to be used.",
  not_your_turn: "It is not your turn.",
  not_the_host: "Only the host can start the game.",
  need_more_players: "At least two players are needed to start.",
  game_already_started: "The game is already running.",
  forced_dice_not_allowed: "That dice roll is not allowed.",
  stale_state: "",
  turn_expired: "",
};

/** Pulls the message out of a PostgREST / supabase-js error. */
export function ludoErrorMessage(raw: unknown): string {
  if (raw && typeof raw === "object" && "message" in raw) {
    return String((raw as { message: unknown }).message ?? "");
  }
  return String(raw ?? "");
}

export function ludoFriendlyError(message: string): string {
  const key = Object.keys(LUDO_ERRORS).find((entry) => message.includes(entry));
  if (key) return LUDO_ERRORS[key]!;
  return "Something went wrong. Try again.";
}
