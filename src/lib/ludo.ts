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
  "blue",
  "yellow",
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
  red: "#e05252",
  green: "#3f9d63",
  blue: "#4a7fd4",
  yellow: "#d8a32b",
  purple: "#8b5cf6",
  orange: "#e0823a",
  teal: "#2f9d94",
  pink: "#d9649b",
};

export function ludoSeatHex(seat: number): string {
  return LUDO_COLOR_HEX[ludoSeatColorName(seat)];
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
