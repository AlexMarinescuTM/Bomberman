import { describe, expect, it } from "vitest";
import type { CellType } from "../src/bomberman.types";
import { RIPPLE_STEP, clearCrates, computeBlast } from "../src/blast";

const parse = (rows: string[]): CellType[][] =>
  rows.map((r) => [...r].map((ch) => (ch === "#" ? "wall" : ch === "B" ? "brick" : "empty")));

describe("computeBlast", () => {
  it("destroys every crate in range across all four arms (the lost-explosion bug)", () => {
    const grid = parse(["##B##", "##.##", "B..0.", "##.##", "##B##"]);
    const { cells, destroyed } = computeBlast(grid, 2, 2, 2);
    expect(destroyed).toHaveLength(3);
    const brickCells = cells.filter((c) => c.wasBrick);
    expect(brickCells).toHaveLength(3);
    expect(destroyed.every((d) => brickCells.some((c) => c.x === d.x && c.y === d.y))).toBe(true);
  });

  it("always includes the bomb tile itself, even fully walled in", () => {
    const grid = parse(["###", "#.#", "###"]);
    const { cells } = computeBlast(grid, 1, 1, 2);
    expect(cells).toEqual([{ x: 1, y: 1, delay: 0, wasBrick: false }]);
  });

  it("stops an arm at a wall, never crossing into or past it", () => {
    // room spans x=1..3; requesting a range of 4 must not reach the wall at x=4
    const grid = parse(["#####", "#...#", "#####"]);
    const { cells } = computeBlast(grid, 1, 1, 4);
    const rightArm = cells.filter((c) => c.y === 1 && c.x > 1);
    expect(rightArm.map((c) => c.x).sort()).toEqual([2, 3]);
  });

  it("stops an arm at (but including) the first crate", () => {
    const grid = parse(["#######", "#..B..#", "#######"]);
    const { cells, destroyed } = computeBlast(grid, 1, 1, 4);
    const right = cells.filter((c) => c.y === 1 && c.x > 1).sort((a, b) => a.x - b.x);
    expect(right.map((c) => c.x)).toEqual([2, 3]);
    expect(destroyed).toEqual([{ x: 3, y: 1 }]);
    expect(cells.some((c) => c.x > 3)).toBe(false);
  });

  it("ripple delay grows linearly with distance", () => {
    const grid = parse(["#####", "#...#", "#####"]);
    const { cells } = computeBlast(grid, 1, 1, 3);
    const right = cells.filter((c) => c.x > 1).sort((a, b) => a.x - b.x);
    right.forEach((c, i) => expect(c.delay).toBe((i + 1) * RIPPLE_STEP));
  });

  it("never mutates the input grid", () => {
    const grid = parse(["#####", "#BBB#", "#.B.#", "#####"]);
    const before = JSON.stringify(grid);
    computeBlast(grid, 2, 2, 2);
    computeBlast(grid, 2, 2, 2);
    expect(JSON.stringify(grid)).toBe(before);
  });

  it("is deterministic: identical input always yields identical footprint", () => {
    const grid = parse(["#######", "#B.B.B#", "#.....#", "#B.B.B#", "#######"]);
    const first = JSON.stringify(computeBlast(grid, 3, 2, 2));
    for (let i = 0; i < 200; i++) expect(JSON.stringify(computeBlast(grid, 3, 2, 2))).toBe(first);
  });

  it("respects a custom crate cap per arm (pierce power-up)", () => {
    const triple = parse(["######", "#....#", "#.BBB#", "######"]);
    const { destroyed } = computeBlast(triple, 1, 2, 2, 2);
    expect(destroyed).toHaveLength(2); // stops after two, not three
  });
});

describe("clearCrates", () => {
  it("is pure and clears exactly the named tiles", () => {
    const grid = parse(["#####", "#BBB#", "#####"]);
    const before = JSON.stringify(grid);
    const next = clearCrates(grid, [{ x: 1, y: 1 }, { x: 3, y: 1 }]);
    expect(JSON.stringify(grid)).toBe(before);
    expect(next[1][1]).toBe("empty");
    expect(next[1][3]).toBe("empty");
    expect(next[1][2]).toBe("brick");
  });

  it("lets a second blast see the crates the first one cleared", () => {
    const grid = parse(["#######", "#B.B.B#", "#######"]);
    const a = computeBlast(grid, 2, 1, 2);
    expect(a.destroyed).toHaveLength(2);
    const after = clearCrates(grid, a.destroyed);
    const b = computeBlast(after, 2, 1, 2);
    expect(b.destroyed).toHaveLength(0);
    expect(b.cells.filter((c) => c.wasBrick)).toHaveLength(0);
  });
});
