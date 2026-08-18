import { BOMB_PICKUP_CHANCE } from "./bomberman.types";
import type { Pos } from "./bomberman.types";

/**
 * Decides where a blast drops bomb pickups.
 *
 * Each destroyed crate independently rolls for one. On top of that there is a
 * pity rule: if the player has no bombs left and nothing left to collect, a
 * blast that breaks at least one crate is guaranteed to yield a pickup.
 *
 * A blast that breaks *no* crate yields nothing, even when the player is out of
 * bombs -- there is no crate to put a pickup in. That case can strand the
 * player, which is what the soft-lock rescue in the game hook exists to catch.
 *
 * `roll` is injectable so the behaviour can be tested deterministically.
 */
export function choosePickupSpots({
  brickCells,
  survivingPickupCount,
  bombsAvailable,
  roll = Math.random,
}: {
  brickCells: readonly Pos[];
  survivingPickupCount: number;
  bombsAvailable: number;
  roll?: () => number;
}): Pos[] {
  const spots: Pos[] = [];
  for (const c of brickCells) {
    if (roll() < BOMB_PICKUP_CHANCE) spots.push({ x: c.x, y: c.y });
  }

  const wouldBeStranded = bombsAvailable === 0 && survivingPickupCount === 0;
  if (wouldBeStranded && spots.length === 0 && brickCells.length > 0) {
    const pick = brickCells[
      Math.min(brickCells.length - 1, Math.floor(roll() * brickCells.length))
    ];
    spots.push({ x: pick.x, y: pick.y });
  }

  return spots;
}
