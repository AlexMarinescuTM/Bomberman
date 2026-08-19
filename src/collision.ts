import type { CellType, Pos } from "./bomberman.types";

/**
 * Whether anything may step onto a tile: it has to be open floor with no bomb
 * sitting on it. Shared by the player and the enemies so the two can never
 * disagree about what is passable -- the player used to skip the bomb half of
 * this check and could walk straight through a live bomb.
 *
 * Note this only blocks *entering* a bomb tile. Someone already standing on one
 * (having just placed it) can still step off, which is the classic behaviour.
 */
export function isTileWalkable(
  grid: readonly CellType[][],
  bombs: readonly Pos[],
  x: number,
  y: number
): boolean {
  if (grid[y]?.[x] !== "empty") return false;
  return !bombs.some((b) => b.x === x && b.y === y);
}

// ---------------------------------------------------------------------------
// Player/enemy contact.
//
// Tile equality is not good enough here. Both the player and the enemies step
// between whole tiles instantly in game state but *glide* between them on
// screen, so an enemy that had just decided to step onto your tile would kill
// you while its sprite was still a full square away. Contact is therefore
// resolved against the tweened (on-screen) positions, using a hitbox smaller
// than a tile so the sprites have to genuinely overlap.
// ---------------------------------------------------------------------------

/** Fraction of a tile the player actually occupies. Deliberately forgiving. */
export const PLAYER_HITBOX = 0.42;
/** Enemies get a slightly bigger box than the player. */
export const ENEMY_HITBOX = 0.62;
/** How close two centres must get, in tiles, to count as a catch. */
export const CATCH_DISTANCE = (PLAYER_HITBOX + ENEMY_HITBOX) / 2;

/**
 * Where something is *right now* on screen, part way through its slide from one
 * tile to the next. Clamps at both ends, so a finished (or never-started) move
 * simply reports the destination.
 */
export function tweenPos(
  from: Pos,
  to: Pos,
  movedAt: number,
  durationMs: number,
  now: number
): Pos {
  if (durationMs <= 0) return { x: to.x, y: to.y };
  const t = (now - movedAt) / durationMs;
  if (!(t > 0)) return { x: from.x, y: from.y }; // also catches NaN
  if (t >= 1) return { x: to.x, y: to.y };
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

/** True when the two are overlapping enough for the enemy to have caught the player. */
export function isCaught(
  player: Pos,
  enemy: Pos,
  distance: number = CATCH_DISTANCE
): boolean {
  return (
    Math.abs(player.x - enemy.x) < distance && Math.abs(player.y - enemy.y) < distance
  );
}
