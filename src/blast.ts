import { BLAST_CRATES, BLAST_RANGE } from "./bomberman.types";
import type { CellType, ExplosionCell, Pos } from "./bomberman.types";

/** ms between each ring of the blast igniting */
export const RIPPLE_STEP = 65;

const DIRS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
] as const;

/**
 * Works out which tiles a bomb at (bx, by) sets alight, and which crates that
 * destroys. Pure: it reads the grid and returns a result, mutating nothing.
 *
 * That purity is the point. This used to be computed as a side effect *inside* a
 * setState updater, which meant the footprint was filled in at render time --
 * so the code that consumed it (crate break animations, debris) could run
 * against an empty footprint, and React StrictMode's double-invoked updater
 * duplicated entries on top. Keeping it a plain function makes each blast
 * deterministic regardless of when React chooses to render.
 *
 * Each arm runs `range` tiles, stops dead at a wall, and gives out once it has
 * chewed through `maxCrates` crates -- so a regular bomb (1 crate) takes out the
 * first crate in each direction and no more, while the pierce power-up (2) can
 * punch through a second one behind it.
 */
export function computeBlast(
  grid: readonly CellType[][],
  bx: number,
  by: number,
  range: number = BLAST_RANGE,
  maxCrates: number = BLAST_CRATES
): { cells: ExplosionCell[]; destroyed: Pos[] } {
  const cells: ExplosionCell[] = [{ x: bx, y: by, delay: 0, wasBrick: false }];
  const destroyed: Pos[] = [];

  for (const { dx, dy } of DIRS) {
    let cratesHit = 0;
    for (let i = 1; i <= range; i++) {
      const x = bx + dx * i;
      const y = by + dy * i;
      const cell = grid[y]?.[x];
      if (cell === undefined || cell === "wall") break;
      const wasBrick = cell === "brick";
      cells.push({ x, y, delay: i * RIPPLE_STEP, wasBrick });
      if (wasBrick) {
        destroyed.push({ x, y });
        cratesHit++;
        if (cratesHit >= maxCrates) break; // arm spent
      }
    }
  }

  return { cells, destroyed };
}

/** Returns a new grid with the given crates cleared. Does not mutate the input. */
export function clearCrates(
  grid: readonly CellType[][],
  destroyed: readonly Pos[]
): CellType[][] {
  const next = grid.map((row) => [...row]);
  for (const { x, y } of destroyed) next[y][x] = "empty";
  return next;
}
