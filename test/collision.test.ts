import { describe, expect, it } from "vitest";
import type { CellType } from "../src/bomberman.types";
import { CATCH_DISTANCE, isCaught, isTileWalkable, tweenPos } from "../src/collision";

const parse = (rows: string[]): CellType[][] =>
  rows.map((r) => [...r].map((ch) => (ch === "#" ? "wall" : ch === "B" ? "brick" : "empty")));

describe("isTileWalkable", () => {
  const grid = parse(["###", "#.#", "###"]);

  it("allows open floor", () => {
    expect(isTileWalkable(grid, [], 1, 1)).toBe(true);
  });

  it("blocks walls", () => {
    expect(isTileWalkable(grid, [], 0, 0)).toBe(false);
  });

  it("blocks bricks", () => {
    expect(isTileWalkable(parse(["#B#"]), [], 1, 0)).toBe(false);
  });

  it("blocks a tile a bomb is sitting on", () => {
    expect(isTileWalkable(grid, [{ x: 1, y: 1 }], 1, 1)).toBe(false);
  });

  it("blocks off-the-grid coordinates instead of throwing", () => {
    expect(isTileWalkable(grid, [], 99, 99)).toBe(false);
  });
});

describe("tweenPos", () => {
  it("reports the origin before the move starts", () => {
    expect(tweenPos({ x: 0, y: 0 }, { x: 1, y: 0 }, 1000, 500, 1000)).toEqual({ x: 0, y: 0 });
  });

  it("reports the destination once the move has finished", () => {
    expect(tweenPos({ x: 0, y: 0 }, { x: 1, y: 0 }, 1000, 500, 1600)).toEqual({ x: 1, y: 0 });
  });

  it("interpolates part way through", () => {
    expect(tweenPos({ x: 0, y: 0 }, { x: 2, y: 0 }, 1000, 500, 1250)).toEqual({ x: 1, y: 0 });
  });
});

describe("isCaught", () => {
  it("catches when the two hitboxes overlap", () => {
    expect(isCaught({ x: 5, y: 5 }, { x: 5.1, y: 5.1 })).toBe(true);
  });

  it("misses once they are a full tile apart", () => {
    expect(isCaught({ x: 5, y: 5 }, { x: 6, y: 5 })).toBe(false);
  });

  it("sits right at the edge of CATCH_DISTANCE", () => {
    expect(isCaught({ x: 0, y: 0 }, { x: CATCH_DISTANCE - 0.01, y: 0 })).toBe(true);
    expect(isCaught({ x: 0, y: 0 }, { x: CATCH_DISTANCE + 0.01, y: 0 })).toBe(false);
  });
});
