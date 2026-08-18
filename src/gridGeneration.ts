import { COLS, ROWS } from "./bomberman.types";
import type { CellType, Pos, Enemy } from "./bomberman.types";

export function makeGrid(): CellType[][] {
  const grid: CellType[][] = [];
  for (let y = 0; y < ROWS; y++) {
    const row: CellType[] = [];
    for (let x = 0; x < COLS; x++) {
      if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) {
        row.push("wall");
      } else if (x % 2 === 0 && y % 2 === 0) {
        row.push("wall");
      } else {
        row.push("empty");
      }
    }
    grid.push(row);
  }
  // scatter bricks, but keep all four spawn corners (player + 3 enemies) clear
  const clearZones: Pos[] = [
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 },
    { x: COLS - 2, y: ROWS - 2 }, { x: COLS - 3, y: ROWS - 2 }, { x: COLS - 2, y: ROWS - 3 },
    { x: COLS - 2, y: 1 }, { x: COLS - 3, y: 1 }, { x: COLS - 2, y: 2 },
    { x: 1, y: ROWS - 2 }, { x: 2, y: ROWS - 2 }, { x: 1, y: ROWS - 3 },
  ];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (grid[y][x] !== "empty") continue;
      if (clearZones.some((p) => p.x === x && p.y === y)) continue;
      if (Math.random() < 0.62) grid[y][x] = "brick";
    }
  }
  return grid;
}

// Finds the nearest "empty" cell to the given spot via BFS, used as a safety
// net so an enemy (or anything else) never spawns embedded inside a brick/wall.
export function nearestEmptyCell(grid: CellType[][], from: Pos): Pos {
  if (grid[from.y]?.[from.x] === "empty") return from;
  const seen = new Set<string>([`${from.x},${from.y}`]);
  const queue: Pos[] = [from];
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const { dx, dy } of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (grid[ny]?.[nx] === undefined) continue;
      if (grid[ny][nx] === "empty") return { x: nx, y: ny };
      if (grid[ny][nx] === "brick") queue.push({ x: nx, y: ny }); // can still search through/around bricks
    }
  }
  return from; // fallback, should not happen
}

export function makeEnemies(grid: CellType[][]): Enemy[] {
  const spots = [
    { x: COLS - 2, y: 1 },
    { x: 1, y: ROWS - 2 },
    { x: COLS - 2, y: ROWS - 2 },
  ];
  return spots.map((p, i) => {
    const safe = nearestEmptyCell(grid, p);
    return { ...safe, id: i, state: "alive" as const, dyingSince: null };
  });
}
