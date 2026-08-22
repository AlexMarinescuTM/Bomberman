import type { Enemy, Pos } from "./bomberman.types";

export type Dir = { dx: number; dy: number };

export const DIRS: readonly Dir[] = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

/** Odds that a given step is a deliberate move toward the player rather than a wander. */
export const ENEMY_CHASE_CHANCE = 0.25;
/** How many tiles an enemy can "see" when pathing toward the player. */
export const ENEMY_SIGHT = 8;
/** Odds of carrying straight on when the way ahead is clear -- stops the twitchy back-and-forth. */
export const ENEMY_STRAIGHT_BIAS = 0.7;

const sameDir = (a: Dir, b: Dir) => a.dx === b.dx && a.dy === b.dy;

/**
 * Breadth-first search for the first step of the shortest route to `target`,
 * looking no further than `maxDepth` tiles. Returns null when the target is out
 * of range or unreachable.
 */
export function firstStepToward(
  from: Pos,
  target: Pos,
  isOpen: (x: number, y: number) => boolean,
  maxDepth: number
): Dir | null {
  if (from.x === target.x && from.y === target.y) return null;

  const seen = new Set<string>([`${from.x},${from.y}`]);
  let frontier: { x: number; y: number; first: Dir }[] = [];

  for (const d of DIRS) {
    const nx = from.x + d.dx;
    const ny = from.y + d.dy;
    if (!isOpen(nx, ny)) continue;
    if (nx === target.x && ny === target.y) return d;
    seen.add(`${nx},${ny}`);
    frontier.push({ x: nx, y: ny, first: d });
  }

  for (let depth = 1; depth < maxDepth && frontier.length > 0; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      for (const d of DIRS) {
        const nx = node.x + d.dx;
        const ny = node.y + d.dy;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        if (!isOpen(nx, ny)) continue;
        seen.add(key);
        if (nx === target.x && ny === target.y) return node.first;
        next.push({ x: nx, y: ny, first: node.first });
      }
    }
    frontier = next;
  }

  return null;
}

/**
 * Picks an enemy's next step.
 *
 * Three rules, in order:
 *  1. It never stands still -- if any neighbouring tile is open it takes one, so
 *     movement stays continuous.
 *  2. A quarter of the time it paths toward the player instead of wandering.
 *  3. Otherwise it prefers to keep going straight and avoids doubling back,
 *     which reads as purposeful patrolling rather than random jitter.
 *
 * Returns null only when the enemy is genuinely walled in.
 */
export function chooseEnemyMove({
  pos,
  facing,
  target,
  isOpen,
  chaseChance = ENEMY_CHASE_CHANCE,
  sight = ENEMY_SIGHT,
  straightBias = ENEMY_STRAIGHT_BIAS,
  roll = Math.random,
}: {
  pos: Pos;
  facing: Dir | null;
  target: Pos;
  isOpen: (x: number, y: number) => boolean;
  chaseChance?: number;
  sight?: number;
  straightBias?: number;
  roll?: () => number;
}): Dir | null {
  const options = DIRS.filter((d) => isOpen(pos.x + d.dx, pos.y + d.dy));
  if (options.length === 0) return null; // boxed in

  // 1. hunt
  if (roll() < chaseChance) {
    const step = firstStepToward(pos, target, isOpen, sight);
    if (step && options.some((d) => sameDir(d, step))) return step;
  }

  // 2. keep your momentum
  if (facing) {
    const forward = options.find((d) => sameDir(d, facing));
    if (forward && roll() < straightBias) return forward;
  }

  // 3. otherwise take a proper turn. Preference order: a side turn, then
  // straight on, and only double back when there is nowhere else to go -- so
  // `straightBias` really is the odds of continuing straight, not a floor.
  const reverse = facing ? { dx: -facing.dx, dy: -facing.dy } : null;
  const isReverse = (d: Dir) => reverse !== null && sameDir(d, reverse);
  const isForward = (d: Dir) => facing !== null && sameDir(d, facing);

  const sideTurns = options.filter((d) => !isForward(d) && !isReverse(d));
  const notBackwards = options.filter((d) => !isReverse(d));
  const pool =
    sideTurns.length > 0 ? sideTurns : notBackwards.length > 0 ? notBackwards : options;

  return pool[Math.min(pool.length - 1, Math.floor(roll() * pool.length))];
}

/**
 * Sends any enemy heading into `tile` back the way it came.
 *
 * An enemy's logical position jumps to its destination the moment it decides to
 * move -- only the sprite interpolates over the next half second. So checking
 * "is this tile free?" at decision time is not enough on its own: a bomb dropped
 * onto a tile an enemy has *already committed to* would leave it finishing its
 * slide standing on top of the bomb. Reversing the move keeps the invariant that
 * nothing ever occupies a bomb tile.
 *
 * An enemy whose origin is no longer safe is left where it is -- better to let
 * it step off normally on its next tick than to shove it somewhere worse.
 * Returns the original array unchanged when nothing recoils.
 */
export function recoilFromTile(
  enemies: readonly Enemy[],
  tile: Pos,
  now: number,
  canStand: (x: number, y: number) => boolean
): readonly Enemy[] {
  let changed = false;
  const next = enemies.map((en) => {
    if (en.state !== "alive") return en;
    if (en.x !== tile.x || en.y !== tile.y) return en;
    if (en.fromX === en.x && en.fromY === en.y) return en; // already settled
    if (!canStand(en.fromX, en.fromY)) return en;
    changed = true;
    return {
      ...en,
      x: en.fromX,
      y: en.fromY,
      fromX: en.x,
      fromY: en.y,
      movedAt: now,
      facing: { dx: en.fromX - en.x, dy: en.fromY - en.y },
    };
  });
  return changed ? next : enemies;
}
