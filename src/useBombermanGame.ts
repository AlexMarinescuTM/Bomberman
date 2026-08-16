import { useCallback, useEffect, useRef, useState } from "react";
import {
  BLAST_RANGE,
  BOMB_FUSE_MS,
  BOMB_PICKUP_CHANCE,
  CELL,
  DIR_KEYS,
  ENEMY_MOVE_MS,
  EXPLOSION_MS,
  PLAYER_MOVE_MS,
  STARTING_MAX_BOMBS,
} from "./bomberman.types";
import type {
  Bomb,
  CellType,
  Enemy,
  Explosion,
  ExplosionCell,
  Particle,
  Pickup,
  Pos,
} from "./bomberman.types";
import { makeEnemies, makeGrid } from "./gridGeneration";

export function useBombermanGame() {
  const initialGridRef = useRef<CellType[][] | null>(null);
  if (!initialGridRef.current) initialGridRef.current = makeGrid();
  const [grid, setGrid] = useState<CellType[][]>(initialGridRef.current);
  const [player, setPlayer] = useState<Pos>({ x: 1, y: 1 });
  const [enemies, setEnemies] = useState<Enemy[]>(() => makeEnemies(initialGridRef.current!));
  const [bombs, setBombs] = useState<Bomb[]>([]);
  const [maxBombs, setMaxBombs] = useState(STARTING_MAX_BOMBS);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [flash, setFlash] = useState(false);
  const idCounter = useRef(0);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const playerRef = useRef(player);
  playerRef.current = player;
  const statusRef = useRef(status);
  statusRef.current = status;
  const bombsRef = useRef(bombs);
  bombsRef.current = bombs;
  const maxBombsRef = useRef(maxBombs);
  maxBombsRef.current = maxBombs;

  // --- movement: held direction keys drive a fixed-tick walk, same cadence style as
  // enemies, but the first step of a press fires immediately (no tick to wait out) so
  // taps feel instant; holding the key then keeps stepping every PLAYER_MOVE_MS. ---
  const pressedKeysRef = useRef<string[]>([]);
  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);

  const stepPlayer = useCallback((dir: { dx: number; dy: number }) => {
    if (statusRef.current !== "playing") return;
    setPlayer((p) => {
      const nx = p.x + dir.dx;
      const ny = p.y + dir.dy;
      const cell = gridRef.current[ny]?.[nx];
      if (cell === "empty") return { x: nx, y: ny };
      return p;
    });
  }, []);

  const stopRepeat = useCallback(() => {
    if (repeatTimeoutRef.current !== null) {
      clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, []);

  const startRepeat = useCallback(
    (key: string) => {
      stopRepeat();
      const dir = DIR_KEYS[key];
      if (!dir) return;
      stepPlayer(dir); // instant response to the keypress itself
      repeatTimeoutRef.current = window.setTimeout(() => {
        repeatIntervalRef.current = window.setInterval(() => {
          stepPlayer(dir);
        }, PLAYER_MOVE_MS);
      }, PLAYER_MOVE_MS);
    },
    [stepPlayer, stopRepeat]
  );

  const placeBomb = useCallback(() => {
    if (statusRef.current !== "playing") return;
    const p = playerRef.current;
    setBombs((bs) => {
      if (bs.some((b) => b.x === p.x && b.y === p.y)) return bs;
      if (bs.length >= maxBombsRef.current) return bs;
      idCounter.current += 1;
      return [...bs, { x: p.x, y: p.y, id: idCounter.current, placedAt: Date.now() }];
    });
  }, []);

  // --- keyboard: movement keys step immediately and then auto-repeat while held; space places a bomb ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        placeBomb();
        return;
      }
      if (DIR_KEYS[e.key]) {
        e.preventDefault();
        if (!pressedKeysRef.current.includes(e.key)) {
          pressedKeysRef.current.push(e.key);
          startRepeat(e.key);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (DIR_KEYS[e.key]) {
        const wasActive =
          pressedKeysRef.current[pressedKeysRef.current.length - 1] === e.key;
        pressedKeysRef.current = pressedKeysRef.current.filter((k) => k !== e.key);
        if (wasActive) {
          const nextKey = pressedKeysRef.current[pressedKeysRef.current.length - 1];
          if (nextKey) startRepeat(nextKey);
          else stopRepeat();
        }
      }
    };
    const onBlur = () => {
      pressedKeysRef.current = [];
      stopRepeat();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      stopRepeat();
    };
  }, [placeBomb, startRepeat, stopRepeat]);

  // stop any in-flight repeat as soon as the game ends, so a held key can't keep stepping
  useEffect(() => {
    if (status !== "playing") stopRepeat();
  }, [status, stopRepeat]);

  // --- bomb fuse -> explosion ---
  useEffect(() => {
    if (bombs.length === 0) return;
    const t = setInterval(() => {
      const now = Date.now();
      setBombs((bs) => {
        const ready = bs.filter((b) => now - b.placedAt >= BOMB_FUSE_MS);
        if (ready.length === 0) return bs;
        ready.forEach((b) => detonate(b.x, b.y));
        return bs.filter((b) => now - b.placedAt < BOMB_FUSE_MS);
      });
    }, 100);
    return () => clearInterval(t);
  }, [bombs.length]);

  const hitPlayer = useCallback(() => {
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    setLives((l) => {
      const nl = l - 1;
      if (nl <= 0) {
        setStatus("lost");
      } else {
        setPlayer({ x: 1, y: 1 });
      }
      return Math.max(nl, 0);
    });
  }, []);

  const detonate = useCallback((bx: number, by: number) => {
    const RIPPLE_STEP = 65; // ms between each ring of the blast igniting
    const cells: ExplosionCell[] = [{ x: bx, y: by, delay: 0, wasBrick: false }];
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    setGrid((g) => {
      const ng = g.map((row) => [...row]);
      dirs.forEach(({ dx, dy }) => {
        for (let i = 1; i <= BLAST_RANGE; i++) {
          const x = bx + dx * i;
          const y = by + dy * i;
          if (ng[y]?.[x] === undefined || ng[y][x] === "wall") break;
          const wasBrick = ng[y][x] === "brick";
          cells.push({ x, y, delay: i * RIPPLE_STEP, wasBrick });
          if (wasBrick) {
            ng[y][x] = "empty";
            break;
          }
        }
      });
      return ng;
    });

    idCounter.current += 1;
    const expId = idCounter.current;
    setExplosions((ex) => [...ex, { cells, id: expId }]);
    setTimeout(() => {
      setExplosions((ex) => ex.filter((e) => e.id !== expId));
    }, EXPLOSION_MS + BLAST_RANGE * RIPPLE_STEP);

    // richer explosion particles: layered fire, smoke, embers, sparks and debris.
    const fireColors = ["#fff8dc", "#ffe08a", "#ffb347", "#ff7a3c", "#ff4d2e"];
    const smokeColors = ["#b4b0a8", "#8a8a8a", "#6b6b6b", "#4f4f4f"];
    const sparkColors = ["#fff6c8", "#ffe27a", "#ffb347", "#ff7a3c"];
    const brickColors = ["#8a5a3b", "#6b4128", "#a3703f", "#b77a47"];
    const newParticles: Particle[] = [];
    cells.forEach((c) => {
      const cx = c.x * CELL + CELL / 2;
      const cy = c.y * CELL + CELL / 2;

      // Dense hot core.
      const fireCount = 8 + Math.floor(Math.random() * 5);
      for (let i = 0; i < fireCount; i++) {
        idCounter.current += 1;
        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 24;
        newParticles.push({
          id: idCounter.current,
          x: cx,
          y: cy,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist - 4 - Math.random() * 8,
          size: 4 + Math.random() * 7,
          color: fireColors[Math.floor(Math.random() * fireColors.length)],
          delay: c.delay + Math.random() * 45,
          duration: 260 + Math.random() * 260,
          shape: Math.random() < 0.35 ? "ember" : "circle",
          rotation: (Math.random() - 0.5) * 90,
        });
      }

      // Fine sparks shoot farther and faster than the main fire.
      const sparkCount = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < sparkCount; i++) {
        idCounter.current += 1;
        const angle = Math.random() * Math.PI * 2;
        const dist = 28 + Math.random() * 34;
        newParticles.push({
          id: idCounter.current,
          x: cx,
          y: cy,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist - 6 - Math.random() * 14,
          size: 2 + Math.random() * 3,
          color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
          delay: c.delay + 30 + Math.random() * 100,
          duration: 280 + Math.random() * 260,
          shape: "spark",
          rotation: angle * (180 / Math.PI),
        });
      }

      // A softer smoke layer rises behind the fire.
      const smokeCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < smokeCount; i++) {
        idCounter.current += 1;
        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 18;
        newParticles.push({
          id: idCounter.current,
          x: cx + (Math.random() - 0.5) * 10,
          y: cy + (Math.random() - 0.5) * 10,
          tx: Math.cos(angle) * dist,
          ty: -12 - Math.random() * 28,
          size: 8 + Math.random() * 10,
          color: smokeColors[Math.floor(Math.random() * smokeColors.length)],
          delay: c.delay + 100 + Math.random() * 120,
          duration: 650 + Math.random() * 350,
          shape: "smoke",
          rotation: (Math.random() - 0.5) * 35,
        });
      }

      // Extra chunky debris when a brick block breaks apart.
      if (c.wasBrick) {
        const chunkCount = 8;
        for (let i = 0; i < chunkCount; i++) {
          idCounter.current += 1;
          const angle = (Math.PI * 2 * i) / chunkCount + Math.random() * 0.4;
          const dist = 20 + Math.random() * 30;
          newParticles.push({
            id: idCounter.current,
            x: cx,
            y: cy,
            tx: Math.cos(angle) * dist,
            ty: Math.sin(angle) * dist + 4 + Math.random() * 10,
            size: 5 + Math.random() * 7,
            color: brickColors[Math.floor(Math.random() * brickColors.length)],
            delay: c.delay + Math.random() * 35,
            duration: 550 + Math.random() * 300,
            shape: "chunk",
            rotation: (Math.random() - 0.5) * 720,
          });
        }
      }
    });
    const particleIds = newParticles.map((p) => p.id);
    setParticles((ps) => [...ps, ...newParticles]);
    setTimeout(() => {
      setParticles((ps) => ps.filter((p) => !particleIds.includes(p.id)));
    }, 900 + BLAST_RANGE * RIPPLE_STEP);

    // check player hit
    const p = playerRef.current;
    if (cells.some((c) => c.x === p.x && c.y === p.y)) {
      hitPlayer();
    }
    // check enemy hits
    setEnemies((es) =>
      es.map((en) =>
        en.alive && cells.some((c) => c.x === en.x && c.y === en.y)
          ? { ...en, alive: false }
          : en
      )
    );

    // destroyed bricks have a chance to drop a bomb pickup; any pickup caught
    // in this blast (on a tile that just got destroyed) is consumed by the fire.
    const newPickups: Pickup[] = [];
    cells.forEach((c) => {
      if (c.wasBrick && Math.random() < BOMB_PICKUP_CHANCE) {
        idCounter.current += 1;
        newPickups.push({ x: c.x, y: c.y, id: idCounter.current });
      }
    });
    setPickups((ps) => {
      const survived = ps.filter((pk) => !cells.some((c) => c.x === pk.x && c.y === pk.y));
      return [...survived, ...newPickups];
    });
  }, []);

  // --- enemy AI: random walk ---
  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => {
      setEnemies((es) => {
        return es.map((en) => {
          if (!en.alive) return en;
          const dirs = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
            { dx: 0, dy: 0 },
          ];
          const shuffled = dirs.sort(() => Math.random() - 0.5);
          for (const d of shuffled) {
            const nx = en.x + d.dx;
            const ny = en.y + d.dy;
            if (gridRef.current[ny]?.[nx] !== "empty") continue;
            if (bombsRef.current.some((b) => b.x === nx && b.y === ny)) continue;
            return { ...en, x: nx, y: ny };
          }
          return en;
        });
      });
    }, ENEMY_MOVE_MS);
    return () => clearInterval(t);
  }, [status]);

  // --- collision check: enemy touches player ---
  useEffect(() => {
    if (status !== "playing") return;
    const touched = enemies.some((en) => en.alive && en.x === player.x && en.y === player.y);
    if (touched) hitPlayer();
  }, [enemies, player, status, hitPlayer]);

  // --- collision check: player picks up a bomb pickup ---
  useEffect(() => {
    if (status !== "playing") return;
    const hit = pickups.find((pk) => pk.x === player.x && pk.y === player.y);
    if (!hit) return;
    setMaxBombs((m) => m + 1);
    setPickups((ps) => ps.filter((pk) => pk.id !== hit.id));
  }, [player, pickups, status]);

  // --- win check ---
  useEffect(() => {
    if (status !== "playing") return;
    if (enemies.every((e) => !e.alive)) {
      setStatus("won");
    }
  }, [enemies, status]);

  const restart = useCallback(() => {
    const newGrid = makeGrid();
    setGrid(newGrid);
    setPlayer({ x: 1, y: 1 });
    setEnemies(makeEnemies(newGrid));
    setBombs([]);
    setMaxBombs(STARTING_MAX_BOMBS);
    setPickups([]);
    setExplosions([]);
    setLives(3);
    setStatus("playing");
  }, []);

  return {
    grid,
    player,
    enemies,
    bombs,
    maxBombs,
    pickups,
    explosions,
    particles,
    lives,
    status,
    flash,
    restart,
  };
}
