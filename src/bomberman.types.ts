// ---- Config ----
export const COLS = 13;
export const ROWS = 11;
export const CELL = 40;
export const BOMB_FUSE_MS = 1800;
export const EXPLOSION_MS = 500;
export const ENEMY_MOVE_MS = 500;
export const PLAYER_MOVE_MS = 120;
export const BLAST_RANGE = 2;
/** Hard cap on bombs the player can carry -- fixed for the whole run, never raised by pickups. */
export const MAX_BOMBS = 3;
export const BOMB_PICKUP_CHANCE = 1 / 3;
/** How long a death animation plays before the player respawns / an enemy vanishes. */
export const DEATH_ANIM_MS = 2000;
/** How long the player must be truly stuck (no bombs, none ticking, nothing to collect) before a free bomb is granted. */
export const SOFTLOCK_RESCUE_MS = 3000;
/** How long the "here's a free bomb" toast stays up. */
export const RESCUE_NOTICE_MS = 3000;
export const PLAYER_SPAWN: Pos = { x: 1, y: 1 };

export type CellType = "empty" | "wall" | "brick";
export type Pos = { x: number; y: number };
export type Bomb = { x: number; y: number; id: number; placedAt: number };
export type ExplosionCell = { x: number; y: number; delay: number; wasBrick: boolean };
export type Explosion = { cells: ExplosionCell[]; id: number };
/** "dying" enemies are mid-incineration: still drawn, but harmless and frozen. */
export type EnemyState = "alive" | "dying" | "dead";
export type Enemy = {
  x: number;
  y: number;
  id: number;
  state: EnemyState;
  dyingSince: number | null;
};
export type Pickup = { x: number; y: number; id: number };

/** "burn" = caught in a blast (incineration), "hit" = caught by an enemy. */
export type DeathCause = "burn" | "hit";
export type PlayerDeath = { cause: DeathCause; startedAt: number } | null;
export type Particle = {
  id: number;
  x: number; // pixel origin
  y: number;
  tx: number; // travel offset
  ty: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  shape: "circle" | "chunk" | "spark" | "ember" | "smoke";
  rotation: number;
};

export const DIR_KEYS: Record<string, { dx: number; dy: number }> = {
  ArrowUp: { dx: 0, dy: -1 },
  w: { dx: 0, dy: -1 },
  W: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  s: { dx: 0, dy: 1 },
  S: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  a: { dx: -1, dy: 0 },
  A: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  d: { dx: 1, dy: 0 },
  D: { dx: 1, dy: 0 },
};
