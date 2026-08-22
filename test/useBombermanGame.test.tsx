// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOMB_FUSE_MS, MAX_BOMBS } from "../src/bomberman.types";
import type { CellType, Enemy } from "../src/bomberman.types";
import * as blast from "../src/blast";
import * as bombPickups from "../src/bombPickups";
import { BOMB_KICK_MS } from "../src/bombKick";

// The hook creates its own board via gridGeneration, with random crate
// placement -- unusable for assertions that need a known layout. Mocked so
// every test controls exactly what tiles exist and where enemies start.
vi.mock("../src/gridGeneration", () => ({
  makeGrid: vi.fn(),
  makeEnemies: vi.fn(),
  nearestEmptyCell: (_grid: unknown, from: unknown) => from,
}));

import { makeEnemies, makeGrid } from "../src/gridGeneration";
import { useBombermanGame } from "../src/useBombermanGame";

// The hook exposes no imperative placeBomb()/stepPlayer() -- it wires its own
// window keydown/keyup listeners internally, exactly as the real page does.
// So driving it means dispatching real key events, not calling a method.
function pressSpace() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  });
}

/** A quick tap: down then up, so movement never triggers the held-key auto-repeat. */
function pressKeyTap(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key }));
  });
}

/**
 * A COLS x ROWS board (13x11, matching the real constants) that is solid wall
 * everywhere except the tiles named in `open`. Keeps every test's floor plan
 * explicit instead of relying on incidental gaps in a real generated board.
 */
function testGrid(open: { x: number; y: number; brick?: boolean }[]): CellType[][] {
  const ROWS = 11;
  const COLS = 13;
  const g: CellType[][] = Array.from({ length: ROWS }, () => Array<CellType>(COLS).fill("wall"));
  for (const o of open) g[o.y][o.x] = o.brick ? "brick" : "empty";
  return g;
}

/** Three enemies, parked far off-board by default so they never interfere. */
function testEnemies(overrides: Partial<Enemy>[] = []): Enemy[] {
  const base = (id: number): Enemy => ({
    id,
    x: -10 - id,
    y: -10 - id,
    state: "alive",
    dyingSince: null,
    facing: null,
    fromX: -10 - id,
    fromY: -10 - id,
    movedAt: 0,
  });
  const enemies = [base(0), base(1), base(2)];
  overrides.forEach((o, i) => Object.assign(enemies[i], o));
  return enemies;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.mocked(makeGrid).mockReset();
  vi.mocked(makeEnemies).mockReset();
});

afterEach(() => {
  cleanup(); // unmounts, running effect cleanup (removes each test's window listeners)
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("bomb -> fuse -> detonation", () => {
  it("clears exactly the one crate in range, decrements ammo, and reports one explosion", () => {
    // spawn (1,1) with one crate one tile to the right; every other neighbour is wall
    const grid = testGrid([{ x: 1, y: 1 }, { x: 2, y: 1, brick: true }]);
    vi.mocked(makeGrid).mockReturnValue(grid);
    vi.mocked(makeEnemies).mockReturnValue(testEnemies());

    const { result } = renderHook(() => useBombermanGame());
    expect(result.current.bombsAvailable).toBe(MAX_BOMBS);

    pressSpace();
    expect(result.current.bombs).toHaveLength(1);
    expect(result.current.bombsAvailable).toBe(MAX_BOMBS - 1);

    act(() => {
      // past the fuse, the ripple delay to reach the one crate (65ms), and the
      // full EXPLOSION_MS the visual then lingers for
      vi.advanceTimersByTime(BOMB_FUSE_MS + 700);
    });

    expect(result.current.bombs).toHaveLength(0); // consumed
    expect(result.current.grid[1][2]).toBe("empty"); // crate cleared
    expect(result.current.explosions).toHaveLength(0); // already cleaned up by EXPLOSION_MS

    // ammo is still down: detonating never hands a slot back on its own
    expect(result.current.bombsAvailable).toBeLessThanOrEqual(MAX_BOMBS - 1);
  });

  it("shows the explosion while it is live, before it clears", () => {
    const grid = testGrid([{ x: 1, y: 1 }]);
    vi.mocked(makeGrid).mockReturnValue(grid);
    vi.mocked(makeEnemies).mockReturnValue(testEnemies());

    const { result } = renderHook(() => useBombermanGame());
    pressSpace();
    act(() => vi.advanceTimersByTime(BOMB_FUSE_MS + 100));

    expect(result.current.explosions).toHaveLength(1);
    expect(result.current.explosions[0].cells.some((c) => c.x === 1 && c.y === 1)).toBe(true);
  });

  it("under StrictMode, still detonates exactly once per bomb", () => {
    const grid = testGrid([{ x: 1, y: 1 }, { x: 2, y: 1, brick: true }]);
    vi.mocked(makeGrid).mockReturnValue(grid);
    vi.mocked(makeEnemies).mockReturnValue(testEnemies());

    const computeBlastSpy = vi.spyOn(blast, "computeBlast");

    const { result } = renderHook(() => useBombermanGame(), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });

    pressSpace();
    act(() => vi.advanceTimersByTime(BOMB_FUSE_MS + 200));

    // StrictMode double-invokes updater functions to surface impurity; if
    // detonate() were ever called from inside one (the historical bug), this
    // count would double.
    expect(computeBlastSpy).toHaveBeenCalledTimes(1);
    expect(result.current.grid[1][2]).toBe("empty"); // still cleared exactly once
  });
});

describe("restart", () => {
  it("mid-fuse: the stale bomb never detonates against the fresh board", () => {
    const staleGrid = testGrid([{ x: 1, y: 1 }, { x: 2, y: 1, brick: true }]);
    const freshGrid = testGrid([{ x: 1, y: 1 }]); // deliberately no crate, so any clear would be a bug
    vi.mocked(makeGrid).mockReturnValueOnce(staleGrid).mockReturnValue(freshGrid);
    vi.mocked(makeEnemies).mockReturnValue(testEnemies());

    const { result } = renderHook(() => useBombermanGame());
    pressSpace();

    act(() => vi.advanceTimersByTime(BOMB_FUSE_MS - 500)); // well before it would go off
    expect(result.current.bombs).toHaveLength(1);

    act(() => result.current.restart());
    expect(result.current.grid).toEqual(freshGrid);
    expect(result.current.bombs).toHaveLength(0);
    expect(result.current.bombsAvailable).toBe(MAX_BOMBS);

    // advance well past when the stale bomb would have gone off
    act(() => vi.advanceTimersByTime(BOMB_FUSE_MS + 500));

    expect(result.current.bombs).toHaveLength(0); // nothing leaked through
    expect(result.current.grid).toEqual(freshGrid); // fresh board survives untouched
  });

  it("resets the player, lives, and round key", () => {
    const grid = testGrid([{ x: 1, y: 1 }]);
    vi.mocked(makeGrid).mockReturnValue(grid);
    vi.mocked(makeEnemies).mockReturnValue(testEnemies());

    const { result } = renderHook(() => useBombermanGame());
    const roundBefore = result.current.roundKey;
    pressSpace();
    act(() => result.current.restart());

    expect(result.current.player).toEqual({ x: 1, y: 1 });
    expect(result.current.lives).toBe(3);
    expect(result.current.status).toBe("playing");
    expect(result.current.roundKey).toBe(roundBefore + 1);
  });
});

describe("kicked bombs and enemies", () => {
  it("a bomb kicked toward a live enemy stops one tile short, never sharing its tile", () => {
    // The main corridor (y=1, x=1..7) carries a crate at x=2 and, later, the
    // kick. A bomb's own tile is always in its own blast, so the player needs
    // somewhere to retreat to while it cooks -- a short spur below spawn,
    // (1,2)-(1,3), two tiles clear of the blast radius (range 1).
    const grid = testGrid([
      { x: 1, y: 1 }, { x: 2, y: 1, brick: true }, { x: 3, y: 1 }, { x: 4, y: 1 },
      { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 },
      { x: 1, y: 2 }, { x: 1, y: 3 },
    ]);
    vi.mocked(makeGrid).mockReturnValue(grid);
    vi.mocked(makeEnemies).mockReturnValue(testEnemies([{ x: 5, y: 1, fromX: 5, fromY: 1 }]));

    // Force the crate at (2,1) to drop the kick power-up regardless of RNG --
    // chooseCrateDrops is exercised for real everywhere else (see drops.test.ts);
    // here only its outcome matters, not which roll produced it.
    vi.spyOn(bombPickups, "chooseCrateDrops").mockReturnValue([{ x: 2, y: 1, kind: "kick" }]);

    const { result } = renderHook(() => useBombermanGame());

    // 1. drop a bomb at spawn, retreat down the spur to survive it, then
    // return once it has gone off and the crate is cleared
    pressSpace(); // bomb at (1,1)
    pressKeyTap("ArrowDown"); // (1,1) -> (1,2)
    pressKeyTap("ArrowDown"); // (1,2) -> (1,3), clear of the blast radius
    expect(result.current.player).toEqual({ x: 1, y: 3 });

    act(() => vi.advanceTimersByTime(BOMB_FUSE_MS + 200));
    expect(result.current.status).toBe("playing"); // survived their own bomb
    expect(result.current.powerUpDrops).toHaveLength(1);
    expect(result.current.powerUpDrops[0]).toMatchObject({ x: 2, y: 1, kind: "kick" });

    pressKeyTap("ArrowUp"); // (1,3) -> (1,2)
    pressKeyTap("ArrowUp"); // (1,2) -> (1,1)
    pressKeyTap("ArrowRight"); // (1,1) -> (2,1): walk onto the drop

    expect(result.current.player).toEqual({ x: 2, y: 1 });
    expect(result.current.activePowerUps.some((a) => a.kind === "kick")).toBe(true);
    expect(result.current.powerUpDrops).toHaveLength(0);

    // 2. place a second bomb here, step off it, then walk back into it -- the
    // classic kick: the step that would collide instead sends the bomb sliding
    pressSpace(); // bomb at (2,1)
    pressKeyTap("ArrowLeft"); // (2,1) -> (1,1), off the bomb
    expect(result.current.player).toEqual({ x: 1, y: 1 });
    pressKeyTap("ArrowRight"); // walks into the bomb -> kicks it right

    // 3. The enemy AI never idles, so by this point (multiple 500ms AI ticks
    // already elapsed while setting up) it may well have wandered from its
    // starting (5,1) -- that's fine. What must hold regardless of where it
    // currently is: the kick tick's canEnter consults live enemy positions
    // every step, so the sliding bomb can never land on one.
    let moved = false;
    for (let i = 0; i < 12; i++) {
      act(() => vi.advanceTimersByTime(BOMB_KICK_MS));
      const bomb = result.current.bombs[0];
      expect(bomb).toBeDefined(); // fuse has plenty of time left; it can't have gone off
      if (bomb.x !== 2 || bomb.y !== 1) moved = true;
      const aliveEnemies = result.current.enemies.filter((e) => e.state === "alive");
      expect(aliveEnemies.some((e) => e.x === bomb.x && e.y === bomb.y)).toBe(false);
    }
    expect(moved).toBe(true); // the kick genuinely engaged, it isn't just sitting at (2,1)
    expect(result.current.bombs[0].dir).toBeNull(); // corridor is finite -- it settles by now
  });
});

describe("soft-lock rescue", () => {
  it("does nothing while the player still has ammo, bombs ticking, or a pickup waiting", () => {
    const grid = testGrid([{ x: 1, y: 1 }]);
    vi.mocked(makeGrid).mockReturnValue(grid);
    vi.mocked(makeEnemies).mockReturnValue(testEnemies());

    const { result } = renderHook(() => useBombermanGame());
    expect(result.current.bombsAvailable).toBe(MAX_BOMBS);

    act(() => vi.advanceTimersByTime(10000)); // well past the rescue delay
    expect(result.current.rescueNotice).toBeNull();
    expect(result.current.bombsAvailable).toBe(MAX_BOMBS); // untouched
  });
});
