import { describe, expect, it } from "vitest";
import { BOMB_PICKUP_CHANCE, CRATE_DROP_CHANCE } from "../src/bomberman.types";
import { CRATE_POWERUP_CHANCE, chooseCrateDrops } from "../src/bombPickups";
import { ENEMY_DROP_CHANCE, POWERUP_KINDS, rollEnemyDrop } from "../src/powerUps";

const one = [{ x: 2, y: 2 }];
const bricks = [{ x: 3, y: 1 }, { x: 1, y: 3 }, { x: 5, y: 1 }];

describe("drop rate: 33% is for the WHOLE set of drops, not per item", () => {
  it("the constants partition one roll rather than stacking", () => {
    expect(CRATE_DROP_CHANCE).toBeCloseTo(1 / 3, 9);
    expect(ENEMY_DROP_CHANCE).toBeCloseTo(1 / 3, 9);
    expect(CRATE_DROP_CHANCE).toBeCloseTo(ENEMY_DROP_CHANCE, 9);
    expect(BOMB_PICKUP_CHANCE + CRATE_POWERUP_CHANCE).toBeCloseTo(CRATE_DROP_CHANCE, 9);
    expect(BOMB_PICKUP_CHANCE).toBeGreaterThanOrEqual(CRATE_POWERUP_CHANCE);
  });

  it("measured crate rates match: ammo and power-up each half of one-in-three", () => {
    const N = 100000;
    let bomb = 0;
    let power = 0;
    let nothing = 0;
    for (let i = 0; i < N; i++) {
      const d = chooseCrateDrops({ brickCells: one, survivingPickupCount: 1, bombsAvailable: 3 });
      if (d.length === 0) nothing++;
      else if (d[0].kind === "bomb") bomb++;
      else power++;
    }
    const near = (got: number, want: number) => Math.abs(got - want) < 0.012;
    expect(near(bomb / N, 1 / 6)).toBe(true);
    expect(near(power / N, 1 / 6)).toBe(true);
    expect(near(nothing / N, 2 / 3)).toBe(true);
    expect(near((bomb + power) / N, 1 / 3)).toBe(true);
  });

  it("is NOT the per-item behaviour that would compound toward near-certainty", () => {
    // 4 items (bomb + 3 power-ups) each independently at 33% would give ~80%
    const perItem = 1 - (1 - 1 / 3) ** (POWERUP_KINDS.length + 1);
    const N = 50000;
    let anyDrop = 0;
    for (let i = 0; i < N; i++) {
      if (chooseCrateDrops({ brickCells: one, survivingPickupCount: 1, bombsAvailable: 3 }).length > 0) anyDrop++;
    }
    expect(anyDrop / N).toBeLessThan(perItem - 0.2);
  });

  it("adding more power-up kinds cannot raise the overall drop rate", () => {
    const N = 50000;
    let drops = 0;
    const kinds: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const d = chooseCrateDrops({ brickCells: one, survivingPickupCount: 1, bombsAvailable: 3 });
      if (d.length === 0) continue;
      drops++;
      kinds[d[0].kind] = (kinds[d[0].kind] ?? 0) + 1;
    }
    expect(Math.abs(drops / N - 1 / 3)).toBeLessThan(0.015);
    const powerKinds = Object.keys(kinds).filter((k) => k !== "bomb");
    expect(powerKinds.sort()).toEqual([...POWERUP_KINDS].sort());
    const shares = powerKinds.map((k) => kinds[k] / drops);
    expect(Math.max(...shares) - Math.min(...shares)).toBeLessThan(0.05);
  });

  it("crate and enemy drop rates match when measured the same way", () => {
    const N = 50000;
    let crateDrops = 0;
    for (let i = 0; i < N; i++)
      if (chooseCrateDrops({ brickCells: one, survivingPickupCount: 1, bombsAvailable: 3 }).length > 0) crateDrops++;
    let enemyDrops = 0;
    for (let i = 0; i < N; i++) if (rollEnemyDrop()) enemyDrops++;
    expect(Math.abs(crateDrops / N - enemyDrops / N)).toBeLessThan(0.02);
  });
});

describe("chooseCrateDrops", () => {
  it("never yields two drops on one tile, and never more drops than crates", () => {
    for (let i = 0; i < 10000; i++) {
      const d = chooseCrateDrops({ brickCells: bricks, survivingPickupCount: 1, bombsAvailable: 3 });
      const tiles = d.map((x) => `${x.x},${x.y}`);
      expect(new Set(tiles).size).toBe(tiles.length);
      expect(d.length).toBeLessThanOrEqual(bricks.length);
    }
  });

  it("power-up kinds split evenly among themselves", () => {
    const kinds: Record<string, number> = {};
    for (let i = 0; i < 50000; i++) {
      for (const d of chooseCrateDrops({ brickCells: one, survivingPickupCount: 1, bombsAvailable: 3 })) {
        if (d.kind !== "bomb") kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
      }
    }
    const total = Object.values(kinds).reduce((a, b) => a + b, 0);
    const expected = 1 / POWERUP_KINDS.length;
    expect(Math.abs(kinds.invincible / total - expected)).toBeLessThan(0.04);
    expect(Object.keys(kinds).every((k) => (POWERUP_KINDS as readonly string[]).includes(k))).toBe(true);
  });

  describe("the soft-lock pity rule", () => {
    it("always yields at least one bomb (never a power-up) when stranded", () => {
      let worst = Infinity;
      let wrongKind = 0;
      for (let i = 0; i < 10000; i++) {
        const n = 1 + Math.floor(Math.random() * 4);
        const bs = Array.from({ length: n }, (_, k) => ({ x: k, y: 1 }));
        const d = chooseCrateDrops({ brickCells: bs, survivingPickupCount: 0, bombsAvailable: 0 });
        const bombDrops = d.filter((x) => x.kind === "bomb");
        worst = Math.min(worst, bombDrops.length);
        if (bombDrops.length === 0) wrongKind++;
      }
      expect(worst).toBeGreaterThanOrEqual(1);
      expect(wrongKind).toBe(0);
    });

    it("still fires on a forced-unlucky roll", () => {
      const NEVER = () => 0.99;
      const d = chooseCrateDrops({ brickCells: bricks, survivingPickupCount: 0, bombsAvailable: 0, roll: NEVER });
      expect(d).toHaveLength(1);
      expect(d[0].kind).toBe("bomb");
      expect(bricks.some((b) => b.x === d[0].x && b.y === d[0].y)).toBe(true);
    });

    it("never stacks the pity bomb on a tile that already rolled a power-up", () => {
      for (let i = 0; i < 10000; i++) {
        const d = chooseCrateDrops({ brickCells: bricks, survivingPickupCount: 0, bombsAvailable: 0 });
        const tiles = d.map((x) => `${x.x},${x.y}`);
        expect(new Set(tiles).size).toBe(tiles.length);
      }
    });

    it("stays off when the player has ammo, a pickup waiting, or no crates broke", () => {
      const NEVER = () => 0.99;
      expect(
        chooseCrateDrops({ brickCells: bricks, survivingPickupCount: 0, bombsAvailable: 1, roll: NEVER })
      ).toHaveLength(0);
      expect(
        chooseCrateDrops({ brickCells: bricks, survivingPickupCount: 1, bombsAvailable: 0, roll: NEVER })
      ).toHaveLength(0);
      expect(
        chooseCrateDrops({ brickCells: [], survivingPickupCount: 0, bombsAvailable: 0, roll: NEVER })
      ).toHaveLength(0);
    });
  });
});

describe("rollEnemyDrop", () => {
  it("respects an injected roll for deterministic hit/miss", () => {
    expect(rollEnemyDrop(() => 0.99)).toBeNull();
    expect(rollEnemyDrop(() => 0)).not.toBeNull();
  });

  it("kind split is even across all declared kinds", () => {
    const N = 50000;
    const kinds: Record<string, number> = {};
    let drops = 0;
    for (let i = 0; i < N; i++) {
      const k = rollEnemyDrop();
      if (k) {
        drops++;
        kinds[k] = (kinds[k] ?? 0) + 1;
      }
    }
    const expected = 1 / POWERUP_KINDS.length;
    for (const k of POWERUP_KINDS) {
      expect(Math.abs((kinds[k] ?? 0) / drops - expected)).toBeLessThan(0.04);
    }
  });
});
