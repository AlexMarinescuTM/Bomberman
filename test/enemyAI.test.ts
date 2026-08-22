import { describe, expect, it } from "vitest";
import type { CellType, Enemy } from "../src/bomberman.types";
import { ENEMY_MOVE_MS } from "../src/bomberman.types";
import { isTileWalkable, tweenPos } from "../src/collision";
import {
  ENEMY_CHASE_CHANCE,
  ENEMY_STRAIGHT_BIAS,
  chooseEnemyMove,
  firstStepToward,
  recoilFromTile,
} from "../src/enemyAI";

const parse = (rows: string[]): CellType[][] =>
  rows.map((r) => [...r].map((ch) => (ch === "#" ? "wall" : ch === "B" ? "brick" : "empty")));

const mapFrom = (rows: string[]) => (x: number, y: number) => rows[y]?.[x] === ".";

describe("chooseEnemyMove", () => {
  it("never idles: always returns a move when a neighbour is open", () => {
    const isOpen = mapFrom(["#####", "#...#", "#...#", "#...#", "#####"]);
    for (let i = 0; i < 5000; i++) {
      const step = chooseEnemyMove({ pos: { x: 2, y: 2 }, facing: null, target: { x: 3, y: 3 }, isOpen });
      expect(step).not.toBeNull();
      expect(step!.dx === 0 && step!.dy === 0).toBe(false);
    }
  });

  it("returns null rather than moving into a wall when fully boxed in", () => {
    const isOpen = mapFrom(["###", "###", "###"]);
    const step = chooseEnemyMove({ pos: { x: 1, y: 1 }, facing: null, target: { x: 1, y: 1 }, isOpen });
    expect(step).toBeNull();
  });

  it("every chosen move lands on an open tile through a maze", () => {
    const rows = ["#######", "#.#...#", "#.#.#.#", "#...#.#", "#.###.#", "#.....#", "#######"];
    const isOpen = mapFrom(rows);
    let pos = { x: 1, y: 1 };
    let facing = null as { dx: number; dy: number } | null;
    for (let i = 0; i < 5000; i++) {
      const step = chooseEnemyMove({ pos, facing, target: { x: 5, y: 5 }, isOpen });
      if (!step) break;
      const nx = pos.x + step.dx;
      const ny = pos.y + step.dy;
      expect(isOpen(nx, ny)).toBe(true);
      pos = { x: nx, y: ny };
      facing = step;
    }
  });

  it("chases toward the player about ENEMY_CHASE_CHANCE of the time", () => {
    expect(ENEMY_CHASE_CHANCE).toBe(0.25);
    // long corridor, enemy facing AWAY from the player -- only a chase decision turns it around
    const isOpen = mapFrom(["#########", "#.......#", "#########"]);
    const N = 20000;
    let toward = 0;
    for (let i = 0; i < N; i++) {
      const step = chooseEnemyMove({
        pos: { x: 4, y: 1 },
        facing: { dx: -1, dy: 0 },
        target: { x: 7, y: 1 },
        isOpen,
      });
      if (step!.dx === 1) toward++;
    }
    expect(toward / N).toBeGreaterThan(0.22);
    expect(toward / N).toBeLessThan(0.28);
  });

  it("prefers going straight and rarely doubles back", () => {
    expect(ENEMY_STRAIGHT_BIAS).toBe(0.7);
    const isOpen = mapFrom(["#####", "#...#", "#...#", "#...#", "#####"]);
    const N = 15000;
    let straight = 0;
    let reverse = 0;
    for (let i = 0; i < N; i++) {
      // target sits on the enemy so a chase decision yields no route, isolating momentum
      const step = chooseEnemyMove({
        pos: { x: 2, y: 2 },
        facing: { dx: 1, dy: 0 },
        target: { x: 2, y: 2 },
        isOpen,
      });
      if (step!.dx === 1) straight++;
      if (step!.dx === -1) reverse++;
    }
    expect(straight / N).toBeGreaterThan(0.65);
    expect(straight / N).toBeLessThan(0.75);
    expect(reverse / N).toBeLessThan(0.02);
  });

  it("reverses in a dead end instead of freezing", () => {
    const isOpen = mapFrom(["####", "#..#", "####"]);
    const step = chooseEnemyMove({
      pos: { x: 2, y: 1 },
      facing: { dx: 1, dy: 0 },
      target: { x: 2, y: 1 },
      isOpen,
    });
    expect(step).toEqual({ dx: -1, dy: 0 });
  });

  it("never enters a bomb tile even with momentum aimed straight at it", () => {
    const g = parse(["#####", "#...#", "#...#", "#...#", "#####"]);
    const bombs = [{ x: 2, y: 1 }]; // directly above the enemy
    const isOpen = (x: number, y: number) => isTileWalkable(g, bombs, x, y);
    for (let i = 0; i < 5000; i++) {
      const step = chooseEnemyMove({ pos: { x: 2, y: 2 }, facing: { dx: 0, dy: -1 }, target: { x: 2, y: 1 }, isOpen });
      if (step) expect(2 + step.dx === 2 && 2 + step.dy === 1).toBe(false);
    }
  });

  it("can still step off a bomb it is standing on", () => {
    const g = parse(["#####", "#...#", "#####"]);
    const bombs = [{ x: 2, y: 1 }];
    const isOpen = (x: number, y: number) => isTileWalkable(g, bombs, x, y);
    const step = chooseEnemyMove({ pos: { x: 2, y: 1 }, facing: null, target: { x: 1, y: 1 }, isOpen });
    expect(step).not.toBeNull();
    expect(isOpen(2 + step!.dx, 1 + step!.dy)).toBe(true);
  });

  it("stays put rather than clipping out when boxed in entirely by bombs", () => {
    const g = parse(["#####", "#...#", "#...#", "#...#", "#####"]);
    const bombs = [{ x: 2, y: 1 }, { x: 2, y: 3 }, { x: 1, y: 2 }, { x: 3, y: 2 }];
    const isOpen = (x: number, y: number) => isTileWalkable(g, bombs, x, y);
    const step = chooseEnemyMove({ pos: { x: 2, y: 2 }, facing: { dx: 1, dy: 0 }, target: { x: 1, y: 1 }, isOpen });
    expect(step).toBeNull();
  });

  it("20k steps down a corridor with a bomb ahead: never steps onto it", () => {
    const wide = parse(["#######", "#.....#", "#######"]);
    const bombs = [{ x: 4, y: 1 }];
    const isOpen = (x: number, y: number) => isTileWalkable(wide, bombs, x, y);
    let pos = { x: 3, y: 1 };
    let facing = { dx: 1, dy: 0 };
    for (let i = 0; i < 5000; i++) {
      const step = chooseEnemyMove({ pos, facing, target: { x: 5, y: 1 }, isOpen });
      if (!step) break;
      const nx = pos.x + step.dx;
      const ny = pos.y + step.dy;
      expect(bombs.some((b) => b.x === nx && b.y === ny)).toBe(false);
      pos = { x: nx, y: ny };
      facing = step;
    }
  });
});

describe("firstStepToward", () => {
  it("heads straight down a corridor toward the player", () => {
    const isOpen = mapFrom(["#######", "#.....#", "#######"]);
    expect(firstStepToward({ x: 1, y: 1 }, { x: 5, y: 1 }, isOpen, 8)).toEqual({ dx: 1, dy: 0 });
    expect(firstStepToward({ x: 5, y: 1 }, { x: 1, y: 1 }, isOpen, 8)).toEqual({ dx: -1, dy: 0 });
  });

  it("routes around a blocking wall instead of through it", () => {
    const isOpen = mapFrom(["#####", "#.#.#", "#...#", "#####"]);
    expect(firstStepToward({ x: 1, y: 1 }, { x: 3, y: 1 }, isOpen, 8)).toEqual({ dx: 0, dy: 1 });
  });

  it("returns null beyond the sight range or when unreachable", () => {
    const isOpen = mapFrom(["#######", "#.....#", "#######"]);
    expect(firstStepToward({ x: 1, y: 1 }, { x: 5, y: 1 }, isOpen, 2)).toBeNull();
    expect(firstStepToward({ x: 1, y: 1 }, { x: 99, y: 99 }, isOpen, 8)).toBeNull();
  });

  it("a hunting enemy has no route once the only corridor is bomb-severed", () => {
    const g = parse(["#######", "#.....#", "#######"]);
    const bombs = [{ x: 3, y: 1 }];
    const isOpen = (x: number, y: number) => isTileWalkable(g, bombs, x, y);
    expect(firstStepToward({ x: 2, y: 1 }, { x: 4, y: 1 }, isOpen, 8)).toBeNull();
  });

  it("takes a detour around a bomb rather than crossing it", () => {
    const g = parse(["#####", "#...#", "#.#.#", "#...#", "#####"]);
    const bombs = [{ x: 2, y: 1 }];
    const isOpen = (x: number, y: number) => isTileWalkable(g, bombs, x, y);
    const step = firstStepToward({ x: 1, y: 1 }, { x: 3, y: 1 }, isOpen, 12);
    expect(step).not.toBeNull();
    expect(step!.dx === 1 && step!.dy === 0).toBe(false); // not straight through the bomb
    expect(isOpen(1 + step!.dx, 1 + step!.dy)).toBe(true);
  });
});

describe("recoilFromTile", () => {
  const enemy = (o: Partial<Enemy> = {}): Enemy => ({
    id: 1,
    x: 3,
    y: 1,
    fromX: 2,
    fromY: 1,
    movedAt: 1000,
    state: "alive",
    facing: { dx: 1, dy: 0 },
    dyingSince: null,
    ...o,
  });

  const g = parse(["#####", "#...#", "#####"]);
  const wide = parse(["#######", "#.....#", "#######"]);

  it("turns back an enemy already sliding into the tile a bomb just landed on", () => {
    const canStand = (x: number, y: number) => isTileWalkable(g, [{ x: 3, y: 1 }], x, y);
    const out = recoilFromTile([enemy()], { x: 3, y: 1 }, 1200, canStand);
    expect(out[0].x).toBe(2);
    expect(out[0].y).toBe(1);
    expect(out[0].fromX).toBe(3);
    expect(out[0].fromY).toBe(1);
    expect(out[0].movedAt).toBe(1200);
    expect(out[0].facing).toEqual({ dx: -1, dy: 0 });
  });

  it("after recoiling, distance from the bomb only ever increases", () => {
    const canStand = (x: number, y: number) => isTileWalkable(g, [{ x: 3, y: 1 }], x, y);
    const e = recoilFromTile([enemy()], { x: 3, y: 1 }, 1200, canStand)[0];
    expect(e.x === 3 && e.y === 1).toBe(false);
    let prev = -1;
    for (let ms = 0; ms <= ENEMY_MOVE_MS; ms += 10) {
      const p = tweenPos({ x: e.fromX, y: e.fromY }, { x: e.x, y: e.y }, e.movedAt, ENEMY_MOVE_MS, 1200 + ms);
      const dist = Math.abs(p.x - 3) + Math.abs(p.y - 1);
      expect(dist).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = dist;
    }
    expect(prev).toBeGreaterThanOrEqual(1 - 1e-9);
  });

  it("leaves enemies with nothing to do with that tile untouched", () => {
    const canStand = () => true;
    const elsewhere = [enemy({ x: 1, y: 1, fromX: 2, fromY: 1 })];
    expect(recoilFromTile(elsewhere, { x: 3, y: 1 }, 1200, canStand)).toBe(elsewhere);

    const settled = [enemy({ x: 3, y: 1, fromX: 3, fromY: 1 })];
    expect(recoilFromTile(settled, { x: 3, y: 1 }, 1200, canStand)).toBe(settled);

    const dying = [enemy({ state: "dying" })];
    expect(recoilFromTile(dying, { x: 3, y: 1 }, 1200, canStand)).toBe(dying);
  });

  it("returns the same array reference when nothing recoils, to skip a re-render", () => {
    const canStand = () => true;
    const es = [enemy({ x: 1, y: 1, fromX: 2, fromY: 1 })];
    expect(recoilFromTile(es, { x: 9, y: 9 }, 1200, canStand)).toBe(es);
  });

  it("never recoils an enemy into a wall or another bomb", () => {
    const walled = parse(["#####", "#.#.#", "#####"]);
    const es = [enemy({ x: 3, y: 1, fromX: 2, fromY: 1 })];
    expect(
      recoilFromTile(es, { x: 3, y: 1 }, 1200, (x, y) => isTileWalkable(walled, [{ x: 3, y: 1 }], x, y))
    ).toBe(es);

    const es2 = [enemy()];
    expect(
      recoilFromTile(es2, { x: 3, y: 1 }, 1200, (x, y) =>
        isTileWalkable(g, [{ x: 3, y: 1 }, { x: 2, y: 1 }], x, y)
      )
    ).toBe(es2);
  });

  it("handles several enemies converging on the same tile independently", () => {
    const es = [
      enemy({ id: 1, x: 3, y: 1, fromX: 2, fromY: 1 }),
      enemy({ id: 2, x: 3, y: 1, fromX: 4, fromY: 1 }),
      enemy({ id: 3, x: 5, y: 1, fromX: 4, fromY: 1 }),
    ];
    const canStand = (x: number, y: number) => isTileWalkable(wide, [{ x: 3, y: 1 }], x, y);
    const out = recoilFromTile(es, { x: 3, y: 1 }, 1200, canStand);
    expect(out[0].x).toBe(2);
    expect(out[1].x).toBe(4);
    expect(out[2].x).toBe(5); // uninvolved, untouched
    expect(out[2].fromX).toBe(4);
    expect(out.some((e) => e.x === 3 && e.y === 1)).toBe(false);
  });

  it("a safe origin always gets the enemy off the bombed tile (fuzzed)", () => {
    let missed = 0;
    let recoils = 0;
    for (let i = 0; i < 4000; i++) {
      const bombs: { x: number; y: number }[] = [];
      const isOpen = (x: number, y: number) => isTileWalkable(wide, bombs, x, y);
      let en = enemy({ x: 2, y: 1, fromX: 1, fromY: 1, movedAt: 0 });
      for (let tick = 0; tick < 12; tick++) {
        const step = chooseEnemyMove({ pos: { x: en.x, y: en.y }, facing: en.facing, target: { x: 5, y: 1 }, isOpen });
        if (!step) break;
        en = { ...en, fromX: en.x, fromY: en.y, x: en.x + step.dx, y: en.y + step.dy, facing: step, movedAt: tick * 500 };

        const dest = { x: en.x, y: en.y };
        if (!bombs.some((b) => b.x === dest.x && b.y === dest.y)) {
          bombs.push(dest);
          const canStand = (x: number, y: number) => isTileWalkable(wide, bombs, x, y);
          const originSafe = canStand(en.fromX, en.fromY);
          en = recoilFromTile([en], dest, tick * 500 + 200, canStand)[0];
          if (originSafe) {
            recoils++;
            if (bombs.some((b) => b.x === en.x && b.y === en.y)) missed++;
          }
        }
      }
    }
    expect(missed).toBe(0);
    expect(recoils).toBeGreaterThan(1000); // the scenario genuinely exercised recoil
  });
});
