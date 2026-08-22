import { describe, expect, it } from "vitest";
import { COLS, PLAYER_SPAWN, ROWS } from "../src/bomberman.types";
import type { CellType, Pos } from "../src/bomberman.types";
import { makeEnemies, makeGrid, nearestEmptyCell } from "../src/gridGeneration";

// The three enemy spawn corners plus the player's, each with its own 3-cell
// clear pocket -- these must never be blocked by a randomly placed crate.
const SPAWN_POCKETS: Pos[] = [
  { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 },
  { x: COLS - 2, y: 1 }, { x: COLS - 3, y: 1 }, { x: COLS - 2, y: 2 },
  { x: 1, y: ROWS - 2 }, { x: 2, y: ROWS - 2 }, { x: 1, y: ROWS - 3 },
  { x: COLS - 2, y: ROWS - 2 }, { x: COLS - 3, y: ROWS - 2 }, { x: COLS - 2, y: ROWS - 3 },
];

describe("makeGrid", () => {
  it("has the configured dimensions", () => {
    const g = makeGrid();
    expect(g).toHaveLength(ROWS);
    expect(g.every((row) => row.length === COLS)).toBe(true);
  });

  it("has a solid wall border on every board it generates", () => {
    for (let i = 0; i < 50; i++) {
      const g = makeGrid();
      expect(g[0].every((c) => c === "wall")).toBe(true);
      expect(g[ROWS - 1].every((c) => c === "wall")).toBe(true);
      expect(g.every((row) => row[0] === "wall" && row[COLS - 1] === "wall")).toBe(true);
    }
  });

  it("never blocks a spawn pocket with a crate, across many boards", () => {
    for (let i = 0; i < 300; i++) {
      const g = makeGrid();
      for (const p of SPAWN_POCKETS) expect(g[p.y][p.x]).not.toBe("brick");
    }
  });

  it("regenerates a genuinely different layout each time", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(makeGrid().map((r) => r.join("")).join("|"));
    expect(seen.size).toBeGreaterThan(90); // near-certain to differ; a little slack for rare collisions
  });

  it("varies its crate count between boards (not a fixed density bug)", () => {
    const counts = new Set(
      Array.from({ length: 30 }, () => makeGrid().flat().filter((c) => c === "brick").length)
    );
    expect(counts.size).toBeGreaterThan(3);
  });

  it("keeps every non-wall tile reachable from every other, regardless of crates", () => {
    // Walls sit only at (even,even) interior coordinates and never touch each
    // other orthogonally, so the non-wall skeleton is a fully connected grid
    // graph by construction -- crates are obstacles a bomb can clear, not
    // permanent dividers. This must hold for every random layout: a bad board
    // could otherwise seal part of the level off forever.
    const g = makeGrid();
    const passable = (x: number, y: number) => g[y]?.[x] !== undefined && g[y][x] !== "wall";
    const start = { x: 1, y: 1 };
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const queue: Pos[] = [start];
    const dirs = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const { dx, dy } of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key) || !passable(nx, ny)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    let totalPassable = 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (passable(x, y)) totalPassable++;
    expect(seen.size).toBe(totalPassable);
  });
});

describe("nearestEmptyCell", () => {
  const parse = (rows: string[]): CellType[][] =>
    rows.map((r) => [...r].map((ch) => (ch === "#" ? "wall" : ch === "B" ? "brick" : "empty")));

  it("returns the starting cell unchanged when it is already empty", () => {
    const g = parse(["###", "#.#", "###"]);
    expect(nearestEmptyCell(g, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });

  it("finds the nearest empty cell when starting on a brick", () => {
    const g = parse(["#####", "#B..#", "#####"]);
    expect(nearestEmptyCell(g, { x: 1, y: 1 })).toEqual({ x: 2, y: 1 });
  });

  it("searches through consecutive bricks to reach open floor", () => {
    const g = parse(["######", "#BB..#", "######"]);
    const found = nearestEmptyCell(g, { x: 1, y: 1 });
    expect(g[found.y][found.x]).toBe("empty");
  });

  it("never returns a wall tile, even when it must cross several bricks to avoid one", () => {
    const g = parse(["######", "#BB..#", "#BB#.#", "######"]);
    const found = nearestEmptyCell(g, { x: 1, y: 1 });
    expect(g[found.y]?.[found.x]).toBe("empty");
  });

  it("falls back to the origin when truly nothing empty is reachable", () => {
    // an isolated pocket of bricks walled in on every side
    const g = parse(["#####", "#B#.#", "#B#.#", "#####"]);
    expect(nearestEmptyCell(g, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });
});

describe("makeEnemies", () => {
  it("always spawns exactly three enemies at the same three corners", () => {
    const spots = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const enemies = makeEnemies(makeGrid());
      expect(enemies).toHaveLength(3);
      for (const e of enemies) spots.add(`${e.x},${e.y}`);
    }
    expect(spots.size).toBe(3);
    expect(spots.has(`${PLAYER_SPAWN.x},${PLAYER_SPAWN.y}`)).toBe(false);
  });

  it("spawns every enemy on genuinely empty floor", () => {
    for (let i = 0; i < 50; i++) {
      const g = makeGrid();
      for (const e of makeEnemies(g)) expect(g[e.y][e.x]).toBe("empty");
    }
  });

  it("gives every enemy clean starting state", () => {
    const fresh = makeEnemies(makeGrid());
    expect(fresh.every((e) => e.state === "alive")).toBe(true);
    expect(fresh.every((e) => e.dyingSince === null)).toBe(true);
    expect(fresh.every((e) => e.facing === null)).toBe(true);
    expect(fresh.every((e) => e.fromX === e.x && e.fromY === e.y && e.movedAt === 0)).toBe(true);
  });

  it("assigns the same ids every round (why a round key is needed for the render)", () => {
    const a = makeEnemies(makeGrid()).map((e) => e.id);
    const b = makeEnemies(makeGrid()).map((e) => e.id);
    expect(a).toEqual(b);
  });
});
