# Family Ludo — rules and board specification

This document is the **contract** for the Ludo engine. The engine is written
against this specification, and the specification is what the app's `/ludo`
page cites when it explains the game. Where a rule is a house rule rather than
a universal one, it is marked **[house]** and listed again in
[§16 Confirm these](#16-confirm-these) so the family can change it before the
engine is frozen.

Nothing in this document is implemented yet — `/ludo` is still a placeholder.
This file exists so that the engine is built once, against agreed rules.

---

## 1. Purpose and scope

- **Server-authoritative.** Every dice roll and every position change is
  computed in Postgres inside a `security definer` function. The browser sends
  **intents** (`roll`, `move token 2`), never outcomes. A modified client can
  therefore only make legal moves, and cannot influence the dice.
- **2–8 players**, all members of the same family, on one of three boards.
- **No external services.** Ludo needs Supabase only: Postgres for state,
  Realtime for sync. There is no game server to run and no third-party key.
- **Turn-based and asynchronous-friendly.** A game can be left and resumed; the
  state lives in the database, not in a socket.

## 2. Players, seats and tokens

| Term | Meaning |
| --- | --- |
| **Seat** | A position at the table, numbered `0..S-1` clockwise. A seat holds one player and one colour. |
| **Player** | A family member occupying a seat. |
| **Token** | One of the 3–4 pieces a player moves. Identified by `token_index` within its seat. |
| **Yard** | The off-board holding area where a player's tokens start. |
| **Ring** | The shared circular track every token travels. |
| **Home column** | The private lane from the ring to the centre, usable only by its owner. |
| **Home** | The final square in the centre. Reaching it retires a token. |

Board capacity `S` may exceed the number of players: a 4-seat board can host a
2-player game. Seats are assigned **spread apart** (for 2 players on a 4-seat
board: seats 0 and 2, i.e. opposite arms) so nobody starts adjacent to their
only opponent. Unused arms have no tokens and no legal moves.

A game starts when at least **2 seats** are filled and the host presses
*Start*. Seats joining after the start become **spectators** — the engine
rejects actions from anyone without a seat row.

## 3. Board geometry

Each board is a regular `S`-sided polygon drawn as a ring. Every side of the
polygon holds the same number of ring squares, so the ring length is exactly
`T = S × arm`, and seat `k`'s **start square** is at ring index `k × arm`.

```
S=4  →  square  →  4 arms × 13 = 52 ring squares   (the classic board)
S=6  →  hexagon →  6 arms ×  9 = 54 ring squares
S=8  →  octagon →  8 arms ×  7 = 56 ring squares
```

Ring indices are `0 .. T-1`, clockwise, starting at seat 0's start square.

### 3.1 Board table

| Board | Seats | Ring `T` | Squares per arm | Tokens each | Home column `H` | Steps to finish | Total tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Classic** | 4 | 52 | 13 | 4 | 5 | **57** | 16 |
| **Hex** | 6 | 54 | 9 | 4 | 5 | **59** | 24 |
| **Octo** | 8 | 56 | 7 | 3 | 5 | **61** | 24 |

Notes on the choices:

- `H = 5` for every board, so "five steps up your own lane" is a constant the
  player learns once.
- **8-player boards use 3 tokens per player.** 8 × 4 = 32 tokens on a
  56-square ring means more than half the ring is occupied, which makes
  blocking — already a core mechanic — degenerate into a stalemate. 3 tokens
  keeps the Octo board at the same 24-token density as the Hex board.
- Steps to finish is `(T - 1) + H + 1`: travel every ring square, then climb
  the lane, then step onto Home.

### 3.2 Position encoding (internal)

The engine stores each token as a single integer `progress`, **relative to its
own seat**. Relative coordinates are what make capture and "exact roll to
finish" trivial to evaluate, and they are identical on all three boards.

| `progress` | Meaning |
| --- | --- |
| `-1` | In the yard (not on the board). |
| `0 .. T-1` | On the ring. Absolute square = `(seat_start + progress) mod T`. |
| `T .. T+H-1` | In the home column, lane square `progress - T` (0-based). |
| `T+H` | **Home** (retired). Equals the "steps to finish" column above. |

Rendering converts ring progress to an absolute square; the client never
reasons about absolute indices, so a board-shape change cannot introduce a
rules bug.

### 3.3 Home-column entrance

Seat `k` leaves the ring from the square **immediately before its own start
square**, i.e. absolute `(k × arm − 1) mod T`, and climbs a lane pointing at
the centre. This is the classic arrangement: you travel the full ring and turn
off one square short of where you began.

The lane belongs exclusively to its seat: opponents can never be on it, so the
lane is neither a capture zone nor a blocking zone.

### 3.4 Safe squares

A token standing on a safe square **cannot be captured**. Safe squares are
`2 × S` in number — two per seat, at these offsets from that seat's start:

| Board | Safe offsets `G` | Safe squares (absolute, 4-seat example) |
| --- | --- | --- |
| Classic | `0` and `8` | `0, 8, 13, 21, 26, 34, 39, 47` |
| Hex | `0` and `5` | 12 squares |
| Octo | `0` and `4` | 16 squares |

Offset `0` is always a seat's own start square. The second offset is chosen so
the pair sits roughly 40–60 % of the way toward the next start, which avoids
clustering safe squares at the home-column entrances. On the classic board
this reproduces the familiar 8 starred squares.

## 4. Turn structure

A turn is a strict state machine on the game row. Each state accepts exactly
one action type; anything else is rejected with `wrong_phase`.

```
awaiting_roll ──roll──▶ awaiting_move ──move──▶ (turn continues? ) 
      ▲                        │                        │
      │                        │ no legal move          │
      └────────────────────────┴────────────────────────┘
```

1. **`awaiting_roll`** — the player whose turn it is calls `roll`.
2. The server rolls the die, stores it, and computes the legal move set.
3. **If no move is legal** the turn is passed automatically (the client may
   call `pass`, but the server does not require it). A 6 still grants another
   roll even if it could not be used, per §5.
4. **`awaiting_move`** — the player calls `move(token_index)`. The server
   re-validates the move against the stored die and current board.
5. After a legal move, the turn either repeats (extra roll) or advances.

Every transition is guarded by a version check (§11) and written under a row
lock, so two devices submitting at once cannot both succeed.

## 5. Dice

- One standard six-sided die.
- **A 6 is required to leave the yard** and grants **another roll** after the
  move (or after the turn is forfeited, see below).
- **Three consecutive 6s forfeit the turn.** The counter resets whenever the
  turn passes to another seat. There is no additional penalty **[house]**.
- **Capturing grants another roll** **[house]**.
- A player with tokens in the yard but no legal ring move, who rolls a 6,
  moves a token out (that is the legal move).
- The die is generated server-side with `gen_random_bytes` (already used for
  invite codes) and is **never** accepted from the client.

## 6. Movement

A move is a token plus the current die value. It is legal when all of the
following hold:

1. The token belongs to the acting seat.
2. The token is not already at `Home`.
3. The destination is exact:
   - from the yard, only a `6` moves a token out, landing on `progress 0`;
   - on the ring, `progress + die ≤ T-1`, or the move enters/continues in the
     lane, or finishes exactly at `T+H`;
   - **overshooting Home is illegal** (no partial move).
4. The path does not cross an opponent's block (§7.2). The squares strictly
   between origin and destination are checked, plus the destination itself.
5. The destination is not already occupied by **two or more of your own**
   tokens *only if* stacking of your own tokens is disabled — it is **not**
   disabled, so stacking is always legal for your own colour.

If several moves are legal, that is the player's choice. The legal move set is
computed by the server and returned with the roll, so the UI highlights
movable tokens rather than guessing.

## 7. Capture and blocking

### 7.1 Capture

- Landing **exactly** on a square holding **exactly one** opponent token, on a
  **non-safe** ring square, sends that token back to its yard (`progress -1`).
- A capture grants an extra roll **[house]**.
- On a **safe** square, tokens of different colours coexist peacefully — no
  capture, and no extra roll.
- Tokens in a home column can never be captured (no opponent can be there).

### 7.2 Blocking

- **Two or more tokens of the same colour on one ring square form a block.**
- An opponent may neither land on nor pass through a block. A block therefore
  gates the ring, which is why the 8-seat board reduces tokens per player.
- A block does **not** block its own colour.
- A single token is never a block, even on a safe square.
- Home columns are never blocked.

## 8. Home column and finishing

- Only the owning seat's tokens may enter a lane.
- Exact roll required to step onto Home from the last lane square.
- Tokens on Home are retired: they are skipped by all later logic but still
  count for the win condition.

## 9. Winning and ranking

- A player **wins** when all of their tokens are at Home.
- The game then continues for **placement** **[house]**: the winner's turns are
  skipped, and the game ends when all but one player have finished (the last
  player is placed last) or when the host ends it.
- Placement is recorded per seat (`placement` 1, 2, 3 …) and shown in a summary
  sheet with each player's number of tokens home and total progress.
- A game with no activity for **24 hours** is marked `abandoned` but can be
  resumed; nothing is deleted.

## 10. Turn timer and AFK

- Each turn sets `turn_deadline = now() + turn_seconds` (default **45 s**
  **[house]**, chosen per game when it is created).
- When a deadline passes and it is the acting seat's turn, the server resolves
  the turn **automatically**, choosing deterministically:
  1. capture, if any legal move captures;
  2. otherwise exit the yard;
  3. otherwise the token furthest along.
  If nothing is legal the turn is passed.
- Auto-resolution is **lazy** (evaluated on the next request) with an optional
  periodic sweep. It is deterministic: the same state always produces the same
  auto-move, so two devices resolving concurrently cannot diverge.
- A seat may be marked `autoplay` by its owner, in which case every turn is
  auto-resolved immediately.

## 11. Server authority and anti-cheat

| Risk | Control |
| --- | --- |
| Client picks its dice | Die generated server-side; `roll` takes no input. |
| Client moves a token it doesn't own | Seat check inside the function; `auth.uid()` must own the acting seat. |
| Client moves an illegal distance | Destination recomputed from the stored die; overshoot and block crossings rejected. |
| Two devices act at once | `select … for update` on the game row; `expected_version` must match, else `stale_state`. |
| Non-member plays | Family-membership check (same `is_family_member` helper as the rest of the app). |
| Spectator acts | A seat row is required. |
| Disputed outcome | Every accepted action is appended to `ludo_actions` with the die, the move and the resulting version. |

Client input is limited to: `{ action: 'roll' | 'move' | 'pass' | 'start',
token_index?, expected_version }`. Nothing else crosses the boundary.

## 12. Data model

```
ludo_games
  id, family_id, created_by
  board_seats        smallint   -- 4 | 6 | 8
  tokens_per_player  smallint   -- 4 | 4 | 3
  status             text       -- waiting | playing | finished | abandoned
  phase              text       -- awaiting_roll | awaiting_move
  turn_seat          smallint
  turn_deadline      timestamptz
  dice               smallint    -- null until rolled
  consecutive_sixes  smallint
  version            integer     -- monotonic; optimistic concurrency
  state              jsonb       -- authoritative board (§12.1)
  winner_seat        smallint
  turn_seconds       smallint    -- default 45
  created_at, updated_at

ludo_seats
  id, game_id, seat, user_id, color, joined_at,
  placement (nullable), autoplay boolean
  unique (game_id, seat), unique (game_id, user_id)

ludo_actions            -- append-only audit / replay
  id, game_id, seq, seat, action, dice, token_index,
  expected_version, result jsonb, created_at
```

### 12.1 `state` shape

```jsonc
{
  "safeSquares": [0, 8, 13, 21, 26, 34, 39, 47], // derived once from the board
  "tokens": [                                     // one entry per seat
    { "seat": 0, "progress": [-1, 0, 17, 57] },
    { "seat": 2, "progress": [4, -1, -1, -1] }
  ],
  "finishedOrder": [0],
  "lastMove": { "seat": 0, "token": 1, "from": -1, "to": 0, "captured": 2 }
}
```

`state` is **authoritative but derived**: it is always recomputed by the server
from the previous state plus one validated action, never merged from a client.
`lastMove` exists so clients can animate a hop without guessing.

## 13. Realtime contract

- Channel: `ludo:{game_id}`.
- Transport: Postgres changes on `ludo_games` filtered to the game id — RLS
  limits delivery to family members, exactly as for chat and feed.
- Payload: the whole `state` plus `version`. Because a Ludo board carries no
  hidden information, there is no private per-player channel.
- Clients are **read-only renderers**: on any payload they replace local state
  with the payload. There is no client-side rule evaluation, so there is no
  client-side cheating surface and no rule drift between platforms.
- Presence announces who is connected; absence triggers nothing (the turn
  timer handles stragglers).

## 14. Reconnection and persistence

- A refresh loses nothing: state lives in Postgres. The client fetches
  `ludo_games` + `ludo_seats` on mount and subscribes.
- A stale `expected_version` returns `stale_state` and the client refetches
  rather than retrying blindly, which keeps duplicate taps harmless.
- Games survive deploys, because they are data.

## 15. How this will be verified

The engine lives in Postgres, so `npm run db:check` can drive it with no
browser, no Supabase project and no dice luck. The check will seed a game,
force dice values through a test-only hook
(`current_setting('ocf.test_mode') = 'on'`, never set in production), and
assert:

1. a token cannot leave the yard without a 6;
2. overshooting Home is rejected (`illegal_move`);
3. landing on a lone opponent on an unsafe square captures it and re-arms the
   die;
4. the same landing on a **safe** square does not capture;
5. an opponent cannot land on or pass through a two-token block;
6. three consecutive 6s forfeit the turn;
7. a token reaches Home only on an exact roll, and then counts;
8. all-tokens-home sets `status = finished` and records the winner;
9. `expected_version` mismatches return `stale_state` and change nothing;
10. a non-member, a spectator and the wrong seat are all rejected;
11. the turn timer's auto-move is deterministic and reproducible.

That list becomes the acceptance criteria for the milestone.

## 16. Confirm these

Please confirm or change these five choices before the engine is frozen — they
are the only decisions in this document that reasonable families disagree on:

1. **Tokens per player.** Classic 4, Hex 4, **Octo 3** (to avoid a 32-token
   stalemate).
2. **Capturing grants another roll** — currently **yes**.
3. **Two tokens form a block** that opponents cannot pass — currently **yes**
   (this is the biggest single lever on game length).
4. **Turn timer** 45 s, then a deterministic auto-move — currently **yes**.
5. **Continue after the first winner** to rank 2nd, 3rd … — currently **yes**.
