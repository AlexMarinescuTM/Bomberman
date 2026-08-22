import { describe, expect, it } from "vitest";
import type { Bomb, CellType } from "../src/bomberman.types";
import { PLAYER_MOVE_MS } from "../src/bomberman.types";
import { BOMB_KICK_MS, advanceKickedBombs, kickBombAt } from "../src/bombKick";

const parse = (rows: string[]): CellType[][] =>
  rows.map((r) => [...r].map((ch) => (ch === "#" ? "wall" : ch === "B" ? "brick" : "empty")));

const bomb = (o: Partial<Bomb> = {}): Bomb => ({ id: 1, x: 3, y: 1, placedAt: 1000, dir: null, ...o });
const RIGHT = { dx: 1, dy: 0 };
const LEFT = { dx: -1, dy: 0 };
const UP = { dx: 0, dy: -1 };
const DOWN = { dx: 0, dy: 1 };

const hall = parse(["##########", "#........#", "##########"]);

/** The world-only predicate: bomb-vs-bomb is resolved inside advanceKickedBombs itself. */
const world =
  (g: CellType[][], blocked: { x: number; y: number }[] = []) =>
  (_b: Bomb, x: number, y: number) =>
    g[y]?.[x] === "empty" && !blocked.some((p) => p.x === x && p.y === y);

/** Runs a slide to completion. */
function settle(bs: Bomb[], canEnter: (b: Bomb, x: number, y: number) => boolean, cap = 40): Bomb[] {
  for (let i = 0; i < cap; i++) {
    const n = advanceKickedBombs(bs, canEnter);
    if (!n) break;
    bs = n;
    if (!bs.some((b) => b.dir)) break;
  }
  return bs;
}

describe("kickBombAt", () => {
  it("sets the bomb on that tile sliding in the given direction", () => {
    const bs = [bomb()];
    const out = kickBombAt(bs, { x: 3, y: 1 }, RIGHT);
    expect(out).not.toBeNull();
    expect(out![0].dir).toEqual(RIGHT);
    expect(out).not.toBe(bs);
    expect(bs[0].dir).toBeNull(); // original untouched
  });

  it("returns null when there is no bomb on that tile", () => {
    expect(kickBombAt([bomb()], { x: 9, y: 9 }, RIGHT)).toBeNull();
  });

  it("only kicks the bomb on the target tile, leaving others alone", () => {
    const bs = [bomb({ id: 1, x: 3, y: 1 }), bomb({ id: 2, x: 6, y: 1 })];
    const out = kickBombAt(bs, { x: 3, y: 1 }, RIGHT)!;
    expect(out[0].dir).not.toBeNull();
    expect(out[1].dir).toBeNull();
  });

  it("produces a bomb with no dead slide-tracking fields", () => {
    const b = kickBombAt([bomb()], { x: 3, y: 1 }, RIGHT)![0];
    expect(Object.keys(b).sort()).toEqual(["dir", "id", "placedAt", "x", "y"]);
  });

  it("never touches placedAt -- a kick cannot buy the player extra fuse time", () => {
    const bs = settle(kickBombAt([bomb({ placedAt: 1000 })], { x: 3, y: 1 }, RIGHT)!, world(hall));
    expect(bs[0].placedAt).toBe(1000);
    const rekicked = kickBombAt(bs, { x: bs[0].x, y: bs[0].y }, LEFT)!;
    expect(rekicked[0].placedAt).toBe(1000);
  });
});

describe("advanceKickedBombs", () => {
  it("returns null when nothing is sliding", () => {
    expect(advanceKickedBombs([bomb()], world(hall))).toBeNull();
  });

  it("moves one tile per call until something stops it", () => {
    let bs = kickBombAt([bomb({ x: 1, y: 1 })], { x: 1, y: 1 }, RIGHT)!;
    const path: number[] = [];
    for (let i = 0; i < 30; i++) {
      const n = advanceKickedBombs(bs, world(hall));
      if (!n) break;
      bs = n;
      path.push(bs[0].x);
      if (!bs[0].dir) break;
    }
    expect(path.length).toBeGreaterThan(3);
    expect(bs[0].x).toBe(8); // last open tile before the wall
    expect(bs[0].dir).toBeNull();
    expect(advanceKickedBombs(bs, world(hall))).toBeNull();
  });

  it("never moves more than one tile per step", () => {
    let bs = kickBombAt([bomb({ x: 1, y: 1 })], { x: 1, y: 1 }, RIGHT)!;
    let prev = { x: 1, y: 1 };
    for (let i = 0; i < 30; i++) {
      const n = advanceKickedBombs(bs, world(hall));
      if (!n) break;
      bs = n;
      expect(Math.abs(bs[0].x - prev.x) + Math.abs(bs[0].y - prev.y)).toBeLessThanOrEqual(1);
      prev = { x: bs[0].x, y: bs[0].y };
      if (!bs[0].dir) break;
    }
  });

  it("is quicker per tile than the player walks, so a kicked bomb outruns you", () => {
    expect(BOMB_KICK_MS).toBeLessThan(PLAYER_MOVE_MS);
  });

  it("is stopped by a crate", () => {
    const crated = parse(["##########", "#..B.....#", "##########"]);
    const bs = settle(kickBombAt([bomb({ x: 1, y: 1 })], { x: 1, y: 1 }, RIGHT)!, world(crated));
    expect(bs[0]).toMatchObject({ x: 2, dir: null });
  });

  it("is stopped by an enemy and never rolls over it", () => {
    const bs = settle(kickBombAt([bomb({ x: 1, y: 1 })], { x: 1, y: 1 }, RIGHT)!, world(hall, [{ x: 5, y: 1 }]));
    expect(bs[0]).toMatchObject({ x: 4, dir: null });
  });

  it("is stopped by the player and never rolls over them", () => {
    const bs = settle(kickBombAt([bomb({ x: 1, y: 1 })], { x: 1, y: 1 }, RIGHT)!, world(hall, [{ x: 6, y: 1 }]));
    expect(bs[0]).toMatchObject({ x: 5, dir: null });
  });

  it("with nowhere to go, just stays put rather than clipping through", () => {
    const boxed = parse(["###", "#.#", "###"]);
    const bs = advanceKickedBombs(kickBombAt([bomb({ x: 1, y: 1 })], { x: 1, y: 1 }, UP)!, world(boxed))!;
    expect(bs[0]).toMatchObject({ x: 1, y: 1, dir: null });
  });

  describe("multiple bombs sliding simultaneously", () => {
    // All sliding bombs move in the same tick, so bomb-vs-bomb cannot be judged
    // one bomb at a time against pre-move positions -- these are the cases that
    // gets wrong in both directions if it is.
    it("a bomb following another does not stop at a tile being vacated (convoy)", () => {
      const bs = [bomb({ id: 1, x: 2, y: 1, dir: RIGHT }), bomb({ id: 2, x: 3, y: 1, dir: RIGHT })];
      const out = advanceKickedBombs(bs, world(hall))!;
      expect(out[0].x).toBe(3);
      expect(out[1].x).toBe(4);
      expect(out.every((b) => b.dir !== null)).toBe(true);
    });

    it("two bombs converging on one free tile do not stack (head-on)", () => {
      const bs = [bomb({ id: 1, x: 2, y: 1, dir: RIGHT }), bomb({ id: 2, x: 4, y: 1, dir: LEFT })];
      const out = advanceKickedBombs(bs, world(hall))!;
      expect(out[0].x === out[1].x).toBe(false);
      expect(out.every((b) => b.dir === null)).toBe(true);
      expect(out[0].x).toBe(2);
      expect(out[1].x).toBe(4);
    });

    it("adjacent bombs kicked at each other do not swap places", () => {
      const bs = [bomb({ id: 1, x: 2, y: 1, dir: RIGHT }), bomb({ id: 2, x: 3, y: 1, dir: LEFT })];
      const out = advanceKickedBombs(bs, world(hall))!;
      expect(out[0].x).toBe(2);
      expect(out[1].x).toBe(3);
      expect(out.every((b) => b.dir === null)).toBe(true);
    });

    it("a blocked leader strands the follower right behind it (cascade)", () => {
      const bs = [bomb({ id: 1, x: 7, y: 1, dir: RIGHT }), bomb({ id: 2, x: 8, y: 1, dir: RIGHT })];
      const out = advanceKickedBombs(bs, world(hall))!;
      expect(out[0].x).toBe(7);
      expect(out[1].x).toBe(8);
    });

    it("a stationary bomb blocks a sliding one", () => {
      const bs = [bomb({ id: 1, x: 2, y: 1, dir: RIGHT }), bomb({ id: 2, x: 3, y: 1, dir: null })];
      const out = advanceKickedBombs(bs, world(hall))!;
      expect(out[0]).toMatchObject({ x: 2, dir: null });
      expect(out[1]).toMatchObject({ x: 3, dir: null });
    });
  });

  it("30k random multi-bomb kicks: never inside something solid, never sharing a tile, never teleporting", () => {
    const board = parse([
      "#############",
      "#...B...B...#",
      "#.#.#.#.#.#.#",
      "#..B..B..B..#",
      "#.#.#.#.#.#.#",
      "#...........#",
      "#############",
    ]);
    const open: { x: number; y: number }[] = [];
    for (let y = 0; y < board.length; y++)
      for (let x = 0; x < board[y].length; x++) if (board[y][x] === "empty") open.push({ x, y });
    const DIRS = [RIGHT, LEFT, DOWN, UP];

    let inSolid = 0;
    let stacked = 0;
    let teleported = 0;
    let movedAny = 0;
    let multi = 0;
    for (let i = 0; i < 5000; i++) {
      const n = 1 + Math.floor(Math.random() * 3);
      const used = new Set<string>();
      let bs: Bomb[] = [];
      for (let k = 0; k < n; k++) {
        const s = open[Math.floor(Math.random() * open.length)];
        const key = `${s.x},${s.y}`;
        if (used.has(key)) continue;
        used.add(key);
        bs.push(bomb({ id: k + 1, x: s.x, y: s.y, dir: DIRS[Math.floor(Math.random() * 4)] }));
      }
      if (bs.length > 1) multi++;
      const start = bs.map((b) => ({ x: b.x, y: b.y }));

      for (let step = 0; step < 40; step++) {
        const nxt = advanceKickedBombs(bs, world(board));
        if (!nxt) break;
        for (let k = 0; k < bs.length; k++) {
          const d = Math.abs(nxt[k].x - bs[k].x) + Math.abs(nxt[k].y - bs[k].y);
          if (d > 1) teleported++;
        }
        bs = nxt;
        const tiles = bs.map((b) => `${b.x},${b.y}`);
        if (new Set(tiles).size !== tiles.length) stacked++;
        if (!bs.some((b) => b.dir)) break;
      }
      for (const b of bs) if (board[b.y]?.[b.x] !== "empty") inSolid++;
      if (bs.some((b, k) => b.x !== start[k].x || b.y !== start[k].y)) movedAny++;
    }
    expect(inSolid).toBe(0);
    expect(stacked).toBe(0);
    expect(teleported).toBe(0);
    expect(movedAny).toBeGreaterThan(2500);
    expect(multi).toBeGreaterThan(1500);
  });
});
