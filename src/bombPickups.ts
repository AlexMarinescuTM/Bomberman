import {
  BOMB_PICKUP_CHANCE,
  CRATE_DROP_CHANCE,
} from "./bomberman.types";
import type { Pos } from "./bomberman.types";
import { POWERUP_KINDS } from "./powerUps";
import type { PowerUpKind } from "./powerUps";

/** What a destroyed crate left behind: a spare bomb, or one of the power-ups. */
export type CrateDropKind = "bomb" | PowerUpKind;
export type CrateDrop = { x: number; y: number; kind: CrateDropKind };

/** Odds a destroyed crate yields a power-up -- the other half of the drop roll. */
export const CRATE_POWERUP_CHANCE = CRATE_DROP_CHANCE - BOMB_PICKUP_CHANCE;

/**
 * Decides what a blast shakes out of the crates it destroys.
 *
 * Each crate gets ONE roll, partitioned: bomb ammo, then a power-up, then
 * nothing. That single roll is the whole point -- 33% is the rate for the
 * entire set of drops, not per item. Rolling each item separately would
 * compound (three items at 33% each is a 70% chance of *something*), and a
 * crate is a single tile that can only hold a single thing anyway.
 *
 * Ammo and power-ups split that roll evenly, which makes a spare bomb the single
 * most common individual drop (16.7%, against 5.6% for any one power-up) -- the
 * bias is deliberate, because running dry is a fail state whereas missing a
 * power-up is only a missed opportunity. CRATE_BOMB_SHARE is the dial.
 *
 * On top of that there is a pity rule: if the player has no bombs left and
 * nothing left to collect, a blast that breaks at least one crate is guaranteed
 * to yield a *bomb* specifically -- a power-up would not get them unstuck.
 *
 * A blast that breaks no crate yields nothing at all, even when the player is
 * out of bombs. That case can strand them, which is what the soft-lock rescue in
 * the game hook exists to catch.
 *
 * `roll` is injectable so the behaviour can be tested deterministically.
 */
export function chooseCrateDrops({
  brickCells,
  survivingPickupCount,
  bombsAvailable,
  roll = Math.random,
}: {
  brickCells: readonly Pos[];
  survivingPickupCount: number;
  bombsAvailable: number;
  roll?: () => number;
}): CrateDrop[] {
  const drops: CrateDrop[] = [];

  for (const c of brickCells) {
    const r = roll();
    if (r < BOMB_PICKUP_CHANCE) {
      drops.push({ x: c.x, y: c.y, kind: "bomb" });
    } else if (r < CRATE_DROP_CHANCE) {
      const i = Math.min(
        POWERUP_KINDS.length - 1,
        Math.floor(roll() * POWERUP_KINDS.length)
      );
      drops.push({ x: c.x, y: c.y, kind: POWERUP_KINDS[i] });
    }
  }

  const wouldBeStranded = bombsAvailable === 0 && survivingPickupCount === 0;
  if (wouldBeStranded && !drops.some((d) => d.kind === "bomb") && brickCells.length > 0) {
    const pick =
      brickCells[Math.min(brickCells.length - 1, Math.floor(roll() * brickCells.length))];
    // that crate may already have rolled a power-up; the bomb takes the tile,
    // since being able to move at all beats any power-up
    const clash = drops.findIndex((d) => d.x === pick.x && d.y === pick.y);
    if (clash >= 0) drops.splice(clash, 1);
    drops.push({ x: pick.x, y: pick.y, kind: "bomb" });
  }

  return drops;
}
