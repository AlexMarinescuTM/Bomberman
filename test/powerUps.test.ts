import { describe, expect, it } from "vitest";
import {
  BLAST_CRATES,
  BLAST_RANGE,
  PIERCE_BLAST_CRATES,
  PIERCE_BLAST_RANGE,
} from "../src/bomberman.types";
import type { CellType } from "../src/bomberman.types";
import { computeBlast } from "../src/blast";
import {
  POWERUP_KINDS,
  POWERUP_MS,
  applyPowerUp,
  blastShapeFor,
  hasPowerUp,
  secondsLeft,
} from "../src/powerUps";

const parse = (rows: string[]): CellType[][] =>
  rows.map((r) => [...r].map((ch) => (ch === "#" ? "wall" : ch === "B" ? "brick" : "empty")));

describe("blastShapeFor", () => {
  it("regular blast: one tile out, one crate per direction", () => {
    expect(BLAST_RANGE).toBe(1);
    expect(BLAST_CRATES).toBe(1);
    expect(blastShapeFor(false)).toEqual({ range: BLAST_RANGE, crates: BLAST_CRATES });

    const open = parse(["#######", "#.....#", "#.....#", "#.....#", "#######"]);
    const { cells } = computeBlast(open, 3, 2);
    expect(cells).toHaveLength(5); // centre + 4 neighbours
    expect(cells.every((c) => Math.abs(c.x - 3) + Math.abs(c.y - 2) <= 1)).toBe(true);
  });

  it("regular blast only takes the nearer of two stacked crates", () => {
    const stacked = parse(["#####", "#...#", "#.B.#", "#.B.#", "#####"]);
    const { destroyed } = computeBlast(stacked, 2, 1);
    expect(destroyed).toEqual([{ x: 2, y: 2 }]);
  });

  it("regular blast hits one crate per direction, all four arms", () => {
    const around = parse(["#####", "#.B.#", "#B.B#", "#.B.#", "#####"]);
    const { destroyed } = computeBlast(around, 2, 2);
    expect(destroyed).toHaveLength(4);
  });

  it("pierce doubles both range and crates-per-arm", () => {
    expect(PIERCE_BLAST_RANGE).toBe(2);
    expect(PIERCE_BLAST_CRATES).toBe(2);
    expect(blastShapeFor(true)).toEqual({ range: PIERCE_BLAST_RANGE, crates: PIERCE_BLAST_CRATES });

    const stacked = parse(["#####", "#...#", "#.B.#", "#.B.#", "#####"]);
    const s = blastShapeFor(true);
    const { destroyed } = computeBlast(stacked, 2, 1, s.range, s.crates);
    expect(destroyed).toHaveLength(2);
    expect(destroyed[0].y).toBe(2);
    expect(destroyed[1].y).toBe(3);
  });

  it("pierce still stops after its own cap, not the whole row", () => {
    const triple = parse(["######", "#....#", "#.BBB#", "######"]);
    const s = blastShapeFor(true);
    const { destroyed } = computeBlast(triple, 1, 2, s.range, s.crates);
    expect(destroyed).toHaveLength(2);
  });
});

describe("applyPowerUp / hasPowerUp", () => {
  const t0 = 1_000_000;

  it("adds a new power-up lasting POWERUP_MS", () => {
    expect(POWERUP_MS).toBe(30000);
    let active = applyPowerUp([], "invincible", t0);
    expect(hasPowerUp(active, "invincible")).toBe(true);
    expect(active[0].expiresAt).toBe(t0 + POWERUP_MS);
  });

  it("holds multiple different power-ups at once", () => {
    let active = applyPowerUp([], "invincible", t0);
    active = applyPowerUp(active, "pierce", t0 + 1000);
    expect(active).toHaveLength(2);
    expect(hasPowerUp(active, "pierce")).toBe(true);
  });

  it("re-collecting refreshes the timer instead of stacking a duplicate", () => {
    let active = applyPowerUp([], "invincible", t0);
    active = applyPowerUp(active, "pierce", t0 + 1000);
    const refreshed = applyPowerUp(active, "invincible", t0 + 5000);
    expect(refreshed).toHaveLength(2);
    expect(refreshed.find((a) => a.kind === "invincible")!.expiresAt).toBe(t0 + 5000 + POWERUP_MS);
  });

  it("does not mutate its input array", () => {
    const active = applyPowerUp([], "invincible", t0);
    const before = JSON.stringify(active);
    applyPowerUp(active, "pierce", t0 + 1000);
    expect(JSON.stringify(active)).toBe(before);
  });

  it("all three declared kinds can be held simultaneously", () => {
    let active: ReturnType<typeof applyPowerUp> = [];
    for (const kind of POWERUP_KINDS) active = applyPowerUp(active, kind, t0);
    expect(active).toHaveLength(POWERUP_KINDS.length);
    for (const kind of POWERUP_KINDS) expect(hasPowerUp(active, kind)).toBe(true);
  });
});

describe("secondsLeft", () => {
  const t0 = 500_000;

  it("reads the full duration, and counts down correctly", () => {
    expect(secondsLeft(t0 + 30000, t0)).toBe(30);
    expect(secondsLeft(t0 + 500, t0)).toBe(1);
  });

  it("floors at 0 and never goes negative", () => {
    expect(secondsLeft(t0, t0)).toBe(0);
    expect(secondsLeft(t0 - 99999, t0)).toBe(0);
  });
});
