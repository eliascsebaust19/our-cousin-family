import { describe, expect, it } from "vitest";
import {
  LUDO_BOARD_SEATS,
  LUDO_COLOR_HEX,
  LUDO_VIEWBOX,
  ludoAbsSquare,
  ludoBoardLabel,
  ludoCenterPoint,
  ludoColumnCells,
  ludoDestination,
  ludoErrorMessage,
  ludoFinishLine,
  ludoFriendlyError,
  ludoIsSafeSquare,
  ludoProgressLabel,
  ludoRingAngle,
  ludoRingCellSize,
  ludoRingCells,
  ludoRingLength,
  ludoRingPoint,
  ludoSafeOffset,
  ludoSafeSquares,
  ludoSeatColorName,
  ludoSeatHex,
  ludoStackOffset,
  ludoTokenPositions,
  ludoTokenRadius,
  ludoTokensPerPlayer,
  ludoYardPoint,
} from "@/lib/ludo";

/**
 * The numbers below are the contract shared with the SQL engine
 * (`supabase/migrations/20261016060000_ludo.sql`, documented in
 * docs/ludo-rules.md §3). If the client's geometry ever drifts from the engine's
 * rules, the board would draw legal moves in the wrong place — so the table is
 * asserted literally rather than recomputed from the same helpers.
 */
const BOARD_TABLE = [
  { seats: 4, arm: 13, ring: 52, safeOffset: 8, finish: 57, tokens: 4 },
  { seats: 6, arm: 9, ring: 54, safeOffset: 5, finish: 59, tokens: 4 },
  { seats: 8, arm: 7, ring: 56, safeOffset: 4, finish: 61, tokens: 3 },
] as const;

describe("board dimensions", () => {
  it("exposes exactly the three supported board sizes", () => {
    expect(LUDO_BOARD_SEATS).toEqual([4, 6, 8]);
  });

  it.each(BOARD_TABLE)(
    "$seats players: arm=$arm ring=$ring offset=$safeOffset finish=$finish tokens=$tokens",
    ({ seats, arm, ring, safeOffset, finish, tokens }) => {
      expect(ludoRingLength(seats)).toBe(ring);
      expect(ludoFinishLine(seats)).toBe(finish);
      expect(ludoSafeOffset(seats)).toBe(safeOffset);
      expect(ludoTokensPerPlayer(seats)).toBe(tokens);
      // arm = ring / seats
      expect(ring / seats).toBe(arm);
      // finish = ring + 5 (five home-column squares, then home)
      expect(ludoFinishLine(seats)).toBe(ludoRingLength(seats) + 5);
    },
  );

  it("drops to three tokens only for the 8-seat board", () => {
    // §3.1: with eight players and four tokens each the ring jams; blocking
    // stops being a tactic and becomes a deadlock.
    expect(ludoTokensPerPlayer(8)).toBe(3);
    expect(ludoTokensPerPlayer(4)).toBe(4);
    expect(ludoTokensPerPlayer(6)).toBe(4);
  });
});

describe("safe squares", () => {
  it("is two starred squares per seat, all distinct", () => {
    for (const { seats } of BOARD_TABLE) {
      const safe = ludoSafeSquares(seats);
      expect(safe).toHaveLength(seats * 2);
      expect(new Set(safe).size).toBe(safe.length);
    }
  });

  it("marks every seat's start square", () => {
    for (const { seats, arm } of BOARD_TABLE) {
      const safe = ludoSafeSquares(seats);
      for (let seat = 0; seat < seats; seat += 1) {
        expect(safe).toContain(seat * arm);
      }
    }
  });

  it("computes the exact starred sets", () => {
    expect(ludoSafeSquares(4)).toEqual([0, 8, 13, 21, 26, 34, 39, 47]);
    expect(ludoSafeSquares(6)).toEqual([
      0, 5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50,
    ]);
    expect(ludoSafeSquares(8)).toEqual([
      0, 4, 7, 11, 14, 18, 21, 25, 28, 32, 35, 39, 42, 46, 49, 53,
    ]);
  });

  it("is sorted ascending and stays inside the ring", () => {
    for (const { seats } of BOARD_TABLE) {
      const safe = ludoSafeSquares(seats);
      expect([...safe].sort((a, b) => a - b)).toEqual(safe);
      for (const square of safe) {
        expect(square).toBeGreaterThanOrEqual(0);
        expect(square).toBeLessThan(ludoRingLength(seats));
      }
    }
  });

  it("answers ludoIsSafeSquare consistently", () => {
    expect(ludoIsSafeSquare(4, 0)).toBe(true);
    expect(ludoIsSafeSquare(4, 8)).toBe(true);
    expect(ludoIsSafeSquare(4, 1)).toBe(false);
    expect(ludoIsSafeSquare(4, 52)).toBe(false); // one past the ring
  });
});

describe("ludoAbsSquare", () => {
  it("places progress 0 on the seat's own start square", () => {
    for (const { seats, arm } of BOARD_TABLE) {
      for (let seat = 0; seat < seats; seat += 1) {
        expect(ludoAbsSquare(seats, seat, 0)).toBe(seat * arm);
      }
    }
  });

  it("advances one square per step of progress", () => {
    expect(ludoAbsSquare(4, 0, 0)).toBe(0);
    expect(ludoAbsSquare(4, 0, 1)).toBe(1);
    expect(ludoAbsSquare(4, 1, 0)).toBe(13);
    expect(ludoAbsSquare(4, 1, 3)).toBe(16);
  });

  it("wraps around the ring", () => {
    const ring = ludoRingLength(4);
    // One full lap returns to the start.
    expect(ludoAbsSquare(4, 0, ring)).toBe(0);
    expect(ludoAbsSquare(4, 2, ring)).toBe(26);
    // Past the end wraps rather than overflowing.
    expect(ludoAbsSquare(4, 3, ring + 2)).toBe(ludoAbsSquare(4, 3, 2));
  });

  it("stays within [0, ring) for every seat and a full lap of progress", () => {
    for (const { seats, ring } of BOARD_TABLE) {
      for (let seat = 0; seat < seats; seat += 1) {
        for (let progress = 0; progress < ring; progress += 1) {
          const square = ludoAbsSquare(seats, seat, progress);
          expect(square).toBeGreaterThanOrEqual(0);
          expect(square).toBeLessThan(ring);
        }
      }
    }
  });
});

describe("colours", () => {
  it("gives every seat a distinct colour on the supported boards", () => {
    for (const { seats } of BOARD_TABLE) {
      const names = Array.from({ length: seats }, (_, seat) => ludoSeatColorName(seat));
      expect(new Set(names).size).toBe(seats);
    }
  });

  it("uses the documented first colour, which the engine also calls red", () => {
    expect(ludoSeatColorName(0)).toBe("red");
    expect(ludoSeatHex(0)).toBe(LUDO_COLOR_HEX.red);
  });

  it("returns a hex colour for every seat of every board", () => {
    for (const { seats } of BOARD_TABLE) {
      for (let seat = 0; seat < seats; seat += 1) {
        expect(ludoSeatHex(seat)).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe("ring geometry", () => {
  it("puts square 0 at the top of the circle (12 o'clock)", () => {
    const point = ludoRingPoint(4, 0);
    expect(point.x).toBeCloseTo(LUDO_VIEWBOX / 2, 6);
    expect(point.y).toBeLessThan(LUDO_VIEWBOX / 2);
  });

  it("advances clockwise", () => {
    // A quarter of the way round a 4-seat ring (13/52) is 90°, i.e. 3 o'clock.
    const quarter = ludoRingPoint(4, 13);
    expect(ludoRingAngle(4, 13)).toBeCloseTo(90, 9);
    expect(quarter.x).toBeCloseTo(LUDO_VIEWBOX / 2 + 392, 6);
    expect(quarter.y).toBeCloseTo(LUDO_VIEWBOX / 2, 6);
  });

  it("keeps every square inside the viewBox", () => {
    for (const { seats, ring } of BOARD_TABLE) {
      for (let index = 0; index < ring; index += 1) {
        const { x, y } = ludoRingPoint(seats, index);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(LUDO_VIEWBOX);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(LUDO_VIEWBOX);
      }
    }
  });

  it("shrinks the cells as more seats are added", () => {
    const four = ludoRingCellSize(4);
    const six = ludoRingCellSize(6);
    const eight = ludoRingCellSize(8);
    expect(four).toBeGreaterThan(six);
    expect(six).toBeGreaterThan(eight);
    // Never wider than the cap, and always positive.
    for (const size of [four, six, eight]) {
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThanOrEqual(52);
    }
  });

  it("keeps tokens large enough to tap", () => {
    for (const { seats } of BOARD_TABLE) {
      expect(ludoTokenRadius(seats)).toBeGreaterThanOrEqual(8.5);
      // A token must fit inside its cell.
      expect(ludoTokenRadius(seats)).toBeLessThan(ludoRingCellSize(seats));
    }
  });

  it("builds one cell per ring square and flags the safe ones", () => {
    for (const { seats, ring } of BOARD_TABLE) {
      const cells = ludoRingCells(seats);
      expect(cells).toHaveLength(ring);
      expect(cells.map((cell) => cell.index)).toEqual(
        Array.from({ length: ring }, (_, index) => index),
      );
      const safeSet = new Set(ludoSafeSquares(seats));
      for (const cell of cells) {
        expect(cell.safe).toBe(safeSet.has(cell.index));
      }
    }
  });

  it("marks exactly one start square per seat, evenly spaced", () => {
    for (const { seats, arm } of BOARD_TABLE) {
      const starts = ludoRingCells(seats).filter((cell) => cell.startSeat !== null);
      expect(starts).toHaveLength(seats);
      expect(starts.map((cell) => cell.index)).toEqual(
        Array.from({ length: seats }, (_, seat) => seat * arm),
      );
      expect(starts.map((cell) => cell.startSeat)).toEqual(
        Array.from({ length: seats }, (_, seat) => seat),
      );
    }
  });
});

describe("home columns", () => {
  it("gives every seat five squares running inward", () => {
    for (const { seats } of BOARD_TABLE) {
      for (let seat = 0; seat < seats; seat += 1) {
        const cells = ludoColumnCells(seats, seat);
        expect(cells).toHaveLength(5);
        expect(cells.map((cell) => cell.step)).toEqual([0, 1, 2, 3, 4]);
        expect(cells.every((cell) => cell.seat === seat)).toBe(true);
      }
    }
  });

  it("moves strictly closer to the centre with each step", () => {
    const centre = ludoCenterPoint();
    const distance = (p: { x: number; y: number }) =>
      Math.hypot(p.x - centre.x, p.y - centre.y);

    for (const { seats } of BOARD_TABLE) {
      for (let seat = 0; seat < seats; seat += 1) {
        const distances = ludoColumnCells(seats, seat).map((cell) =>
          distance(cell.point),
        );
        for (let index = 1; index < distances.length; index += 1) {
          expect(distances[index]).toBeLessThan(distances[index - 1]!);
        }
        // The column points inward, so it never crosses the centre.
        expect(Math.min(...distances)).toBeGreaterThan(0);
      }
    }
  });

  it("puts the five column squares on one straight line from the seat's start", () => {
    for (const { seats } of BOARD_TABLE) {
      for (let seat = 0; seat < seats; seat += 1) {
        const cells = ludoColumnCells(seats, seat);
        const angles = new Set(cells.map((cell) => Math.round(cell.angle * 1e6)));
        expect(angles.size).toBe(1);
      }
    }
  });
});

describe("yards and token positions", () => {
  it("sits the yard outside the ring", () => {
    const centre = ludoCenterPoint();
    for (const { seats } of BOARD_TABLE) {
      for (let seat = 0; seat < seats; seat += 1) {
        const yard = ludoYardPoint(seats, seat);
        const radius = Math.hypot(yard.x - centre.x, yard.y - centre.y);
        expect(radius).toBeGreaterThan(392);
        expect(yard.x).toBeGreaterThanOrEqual(0);
        expect(yard.x).toBeLessThanOrEqual(LUDO_VIEWBOX);
        expect(yard.y).toBeGreaterThanOrEqual(0);
        expect(yard.y).toBeLessThanOrEqual(LUDO_VIEWBOX);
      }
    }
  });

  it("gives each seat exactly as many token spots as it has tokens", () => {
    for (const { seats, tokens } of BOARD_TABLE) {
      const positions = ludoTokenPositions(seats);
      expect(positions).toHaveLength(seats);
      for (const seatSpots of positions) {
        expect(seatSpots).toHaveLength(tokens);
      }
    }
  });

  it("never overlaps two seats' yard spots", () => {
    for (const { seats } of BOARD_TABLE) {
      const flat = ludoTokenPositions(seats).flat();
      const rounded = flat.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`);
      expect(new Set(rounded).size).toBe(rounded.length);
    }
  });

  it("splits a stack apart but leaves a lone token centred", () => {
    expect(ludoStackOffset(1, 0, 10)).toEqual({ x: 0, y: 0 });
    expect(ludoStackOffset(4, 0, 10)).toEqual({ x: 0, y: 0 });

    // Indices 1..6 must all differ, otherwise two tokens on one square would be
    // drawn on top of each other.
    const offsets = Array.from({ length: 6 }, (_, index) =>
      ludoStackOffset(7, index + 1, 10),
    );
    const rounded = offsets.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`);
    expect(new Set(rounded).size).toBe(6);
    // The first token stays centred, so the stack grows around it.
    expect(offsets).not.toContainEqual({ x: 0, y: 0 });
  });
});

describe("labels", () => {
  it("describes the yard, the ring, the column and home", () => {
    expect(ludoProgressLabel(4, -1)).toBe("Yard");
    expect(ludoProgressLabel(4, 0)).toBe("Ring 1/52");
    expect(ludoProgressLabel(4, 51)).toBe("Ring 52/52");
    expect(ludoProgressLabel(4, 52)).toBe("Column 1/5");
    expect(ludoProgressLabel(4, 56)).toBe("Column 5/5");
    expect(ludoProgressLabel(4, 57)).toBe("Home");
  });

  it("uses each board's own ring length", () => {
    expect(ludoProgressLabel(6, 0)).toBe("Ring 1/54");
    expect(ludoProgressLabel(6, 53)).toBe("Ring 54/54");
    expect(ludoProgressLabel(8, 0)).toBe("Ring 1/56");
    expect(ludoProgressLabel(8, 55)).toBe("Ring 56/56");
  });

  it("treats the ring as full only at the ring length, not past it", () => {
    // progress === ring is the first column square, not the last ring square.
    for (const { seats, ring } of BOARD_TABLE) {
      expect(ludoProgressLabel(seats, ring - 1)).toBe(`Ring ${ring}/${ring}`);
      expect(ludoProgressLabel(seats, ring)).toBe("Column 1/5");
    }
  });

  it("labels the board size and token count", () => {
    expect(ludoBoardLabel(4)).toContain("4 players");
    expect(ludoBoardLabel(4)).toContain("4 tokens");
    expect(ludoBoardLabel(8)).toContain("8 players");
    expect(ludoBoardLabel(8)).toContain("3 tokens");
  });
});

describe("ludoDestination", () => {
  it("sends a yarded token to its start square whatever the roll", () => {
    // Leaving the yard always lands on progress 0; the engine decides legality,
    // this only predicts where the hint arrow points.
    expect(ludoDestination(-1, 1)).toBe(0);
    expect(ludoDestination(-1, 6)).toBe(0);
  });

  it("adds the roll to progress in play", () => {
    expect(ludoDestination(0, 6)).toBe(6);
    expect(ludoDestination(5, 3)).toBe(8);
  });
});

describe("error messages", () => {
  it("pulls the message out of a supabase-js / PostgREST error", () => {
    expect(ludoErrorMessage({ message: "not_your_turn", code: "P0001" })).toBe(
      "not_your_turn",
    );
    expect(ludoErrorMessage("plain string")).toBe("plain string");
  });

  it("returns an empty string for no error at all", () => {
    expect(ludoErrorMessage(null)).toBe("");
    expect(ludoErrorMessage(undefined)).toBe("");
  });

  it("maps every engine error code to friendly text", () => {
    expect(ludoFriendlyError("not_your_turn")).toBe("It is not your turn.");
    expect(ludoFriendlyError("not_a_member")).toBe(
      "You are not a member of this family.",
    );
    expect(ludoFriendlyError("need_more_players")).toBe(
      "At least two players are needed to start.",
    );
  });

  it("maps the two programmatic codes to an empty string, not a message", () => {
    // stale_state and turn_expired are handled by the caller (refresh / auto
    // resolve), so showing text would be wrong. Callers rely on the falsiness.
    expect(ludoFriendlyError("stale_state")).toBe("");
    expect(ludoFriendlyError("turn_expired")).toBe("");
    expect(ludoFriendlyError("stale_state")).toBeFalsy();
  });

  it("falls back to a generic message for anything unknown", () => {
    expect(ludoFriendlyError("permission denied for table ludo_games")).toBe(
      "Something went wrong. Try again.",
    );
    expect(ludoFriendlyError("")).toBe("Something went wrong. Try again.");
  });

  it("finds the code inside a wrapped error string", () => {
    expect(ludoFriendlyError("error: not_the_host (SQLSTATE P0001)")).toBe(
      "Only the host can start the game.",
    );
  });
});
