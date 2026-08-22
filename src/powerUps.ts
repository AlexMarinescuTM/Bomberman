import {
  BLAST_CRATES,
  BLAST_RANGE,
  PIERCE_BLAST_CRATES,
  PIERCE_BLAST_RANGE,
} from "./bomberman.types";

// ---------------------------------------------------------------------------
// Power-ups dropped by dying enemies and by destroyed crates.
//   invincible -- nothing can kill the player
//   pierce     -- blasts reach further and punch through a second crate
//   kick       -- walking into a live bomb sends it sliding (see bombKick.ts)
// Both the drop lying on the floor and the effect once collected run on the
// same 30 second clock, and they stack: holding all three is fine.
// ---------------------------------------------------------------------------

export type PowerUpKind = "invincible" | "pierce" | "kick";

export const POWERUP_KINDS: readonly PowerUpKind[] = [
  "invincible",
  "pierce",
  "kick",
];

/** How long a drop waits to be collected, and how long its effect then lasts. */
export const POWERUP_MS = 30000;

/** Odds that a dead enemy leaves something behind. */
export const ENEMY_DROP_CHANCE = 1 / 3;

export const POWERUP_LABEL: Record<PowerUpKind, string> = {
  invincible: "SHIELD",
  pierce: "BLAST",
  kick: "KICK",
};

/** A power-up sitting on the floor waiting to be walked over. */
export type PowerUpDrop = {
  id: number;
  x: number;
  y: number;
  kind: PowerUpKind;
  expiresAt: number;
};

/** A power-up the player is currently carrying. */
export type ActivePowerUp = { kind: PowerUpKind; expiresAt: number };

/**
 * Rolls for what (if anything) a dying enemy leaves behind: a 1-in-3 chance of a
 * drop, then an even pick between the kinds. `roll` is injectable for testing.
 */
export function rollEnemyDrop(roll: () => number = Math.random): PowerUpKind | null {
  if (roll() >= ENEMY_DROP_CHANCE) return null;
  const i = Math.min(
    POWERUP_KINDS.length - 1,
    Math.floor(roll() * POWERUP_KINDS.length)
  );
  return POWERUP_KINDS[i];
}

/** Blast dimensions for the current loadout. */
export function blastShapeFor(hasPierce: boolean): { range: number; crates: number } {
  return hasPierce
    ? { range: PIERCE_BLAST_RANGE, crates: PIERCE_BLAST_CRATES }
    : { range: BLAST_RANGE, crates: BLAST_CRATES };
}

/** Adds or refreshes a power-up, so re-collecting one tops its timer back up. */
export function applyPowerUp(
  active: readonly ActivePowerUp[],
  kind: PowerUpKind,
  now: number
): ActivePowerUp[] {
  const expiresAt = now + POWERUP_MS;
  const existing = active.find((a) => a.kind === kind);
  if (!existing) return [...active, { kind, expiresAt }];
  return active.map((a) => (a.kind === kind ? { ...a, expiresAt } : a));
}

export const hasPowerUp = (active: readonly ActivePowerUp[], kind: PowerUpKind) =>
  active.some((a) => a.kind === kind);

/** Whole seconds left on a timer, floored at 0 -- what the header counts down. */
export const secondsLeft = (expiresAt: number, now: number) =>
  Math.max(0, Math.ceil((expiresAt - now) / 1000));
