import type { Bomb, Pos } from "./bomberman.types";
import type { Dir } from "./enemyAI";

// ---------------------------------------------------------------------------
// The "kick" power-up.
//
// Walking into a live bomb while holding it sends the bomb sliding away in the
// direction you walked, one tile at a time, until something stops it. The
// player does not step onto the bomb's tile on the kicking step -- they follow
// it on the next one, which is the classic feel and keeps the "nothing ever
// stands on a bomb" invariant intact.
//
// A kick deliberately does not touch `placedAt`: the fuse keeps burning on its
// original clock, so booting a bomb away buys no extra time.
// ---------------------------------------------------------------------------

/**
 * How long a kicked bomb takes to cross one tile. Comfortably quicker than
 * PLAYER_MOVE_MS so a bomb you kick genuinely outruns you instead of being
 * shoved along one step ahead of your feet.
 */
export const BOMB_KICK_MS = 90;

/**
 * Sets the bomb standing on `tile` sliding in `dir`.
 *
 * Returns null when there is no bomb there, so the caller can tell "kicked" from
 * "nothing to kick" and fall back to the normal blocked-move behaviour.
 */
export function kickBombAt(
  bombs: readonly Bomb[],
  tile: Pos,
  dir: Dir
): Bomb[] | null {
  const target = bombs.find((b) => b.x === tile.x && b.y === tile.y);
  if (!target) return null;
  return bombs.map((b) => (b.id === target.id ? { ...b, dir } : b));
}

const key = (x: number, y: number) => `${x},${y}`;

/**
 * Advances every sliding bomb by one tile, stopping any that has run out of
 * room. `canEnter` rules on the static world -- walls, crates, the player and
 * enemies. Bomb-versus-bomb is resolved in here instead, because it cannot be
 * judged one bomb at a time.
 *
 * The subtlety: all sliding bombs move in the same tick, so asking "is there a
 * bomb on my target tile?" against the pre-move array gets it wrong both ways.
 * A bomb following another would stop short at a tile its leader is in the act
 * of vacating, and two bombs converging on one free tile would each see it
 * empty and both claim it. So destinations are worked out together:
 *
 *   1. anything `canEnter` refuses is blocked outright;
 *   2. a tile claimed by more than one bomb goes to neither;
 *   3. two bombs may not swap tiles, which would pass them through each other;
 *   4. a bomb may not enter a tile whose occupant is staying put -- and because
 *      blocking one bomb can strand the one behind it, that rule is applied
 *      repeatedly until nothing more changes.
 *
 * A blocked bomb settles where it stands and simply stops; it does not bounce
 * or detonate early. Returns null when nothing was sliding, so the caller can
 * skip the re-render.
 */
export function advanceKickedBombs(
  bombs: readonly Bomb[],
  canEnter: (bomb: Bomb, x: number, y: number) => boolean
): Bomb[] | null {
  if (!bombs.some((b) => b.dir)) return null;

  // 1. tentative destinations, filtered by the static world
  const dest = new Map<number, Pos>();
  for (const b of bombs) {
    if (!b.dir) continue;
    const nx = b.x + b.dir.dx;
    const ny = b.y + b.dir.dy;
    if (canEnter(b, nx, ny)) dest.set(b.id, { x: nx, y: ny });
  }

  // 2. a tile two bombs both want goes to neither of them
  const claims = new Map<string, number>();
  for (const d of dest.values()) {
    const k = key(d.x, d.y);
    claims.set(k, (claims.get(k) ?? 0) + 1);
  }
  for (const [id, d] of [...dest]) {
    if ((claims.get(key(d.x, d.y)) ?? 0) > 1) dest.delete(id);
  }

  // 3. no swapping places -- that would slide two bombs through each other
  const at = new Map<string, Bomb>();
  for (const b of bombs) at.set(key(b.x, b.y), b);
  for (const [id, d] of [...dest]) {
    const occupant = at.get(key(d.x, d.y));
    if (!occupant || occupant.id === id) continue;
    const theirs = dest.get(occupant.id);
    const self = bombs.find((b) => b.id === id);
    if (theirs && self && theirs.x === self.x && theirs.y === self.y) {
      dest.delete(id);
      dest.delete(occupant.id);
    }
  }

  // 4. nobody moves onto a tile someone is staying on; cascade until stable
  for (;;) {
    const staying = new Map<string, number>();
    for (const b of bombs) if (!dest.has(b.id)) staying.set(key(b.x, b.y), b.id);

    let settled = true;
    for (const [id, d] of [...dest]) {
      const holder = staying.get(key(d.x, d.y));
      if (holder !== undefined && holder !== id) {
        dest.delete(id);
        settled = false;
      }
    }
    if (settled) break;
  }

  return bombs.map((b) => {
    if (!b.dir) return b;
    const d = dest.get(b.id);
    return d ? { ...b, x: d.x, y: d.y } : { ...b, dir: null };
  });
}
