import { useCallback, useEffect, useRef, useState } from "react";
import {
  BOMB_FUSE_MS,
  CELL,
  DEATH_ANIM_MS,
  DIR_KEYS,
  ENEMY_MOVE_MS,
  EXPLOSION_MS,
  MAX_BOMBS,
  PLAYER_MOVE_MS,
  PLAYER_SPAWN,
  RESCUE_NOTICE_MS,
  SOFTLOCK_RESCUE_MS,
} from "./bomberman.types";
import type {
  Bomb,
  CellType,
  DeathCause,
  Enemy,
  Explosion,
  Particle,
  Pickup,
  PlayerDeath,
  Pos,
} from "./bomberman.types";
import { makeEnemies, makeGrid } from "./gridGeneration";
import { choosePickupSpots } from "./bombPickups";
import {
  CRATE_BREAK_MS,
  crateDebrisSpec,
  crateVariantFor,
} from "./crateBreaks";
import type { CrateBreak } from "./crateBreaks";
import { chooseEnemyMove } from "./enemyAI";
import { clearCrates, computeBlast } from "./blast";
import { isCaught, tweenPos } from "./collision";
import {
  POWERUP_MS,
  applyPowerUp,
  blastShapeFor,
  hasPowerUp,
  rollEnemyDrop,
} from "./powerUps";
import type { ActivePowerUp, PowerUpDrop } from "./powerUps";

export function useBombermanGame() {
  const initialGridRef = useRef<CellType[][] | null>(null);
  if (!initialGridRef.current) initialGridRef.current = makeGrid();
  const [grid, setGrid] = useState<CellType[][]>(initialGridRef.current);
  const [player, setPlayer] = useState<Pos>(PLAYER_SPAWN);
  const [enemies, setEnemies] = useState<Enemy[]>(() => makeEnemies(initialGridRef.current!));
  const [bombs, setBombs] = useState<Bomb[]>([]);
  // bombsAvailable is the ammo the player can actually spend right now. It only
  // drops when a bomb is placed and only rises from pickups (a bomb detonating
  // never hands a "slot" back on its own) -- and it's clamped to MAX_BOMBS,
  // which is a fixed ceiling for the whole run: pickups top the ammo back up,
  // they never raise the cap itself.
  const [bombsAvailable, setBombsAvailable] = useState(MAX_BOMBS);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [crateBreaks, setCrateBreaks] = useState<CrateBreak[]>([]);
  const [powerUpDrops, setPowerUpDrops] = useState<PowerUpDrop[]>([]);
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  // ticks only while something is counting down, so the header can show seconds
  const [now, setNow] = useState(() => Date.now());
  // set when the soft-lock rescue fires, so the UI can show a brief toast
  const [rescueNotice, setRescueNotice] = useState<number | null>(null);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [flash, setFlash] = useState(false);
  // While playerDeath is set the player is mid-animation: frozen, harmless to
  // touch again, and not yet moved back to spawn. respawnKey remounts the
  // player element on respawn so it snaps home instead of sliding across the
  // board on its movement transition.
  const [playerDeath, setPlayerDeath] = useState<PlayerDeath>(null);
  const [respawnKey, setRespawnKey] = useState(0);
  const idCounter = useRef(0);
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const playerRef = useRef(player);
  playerRef.current = player;
  const statusRef = useRef(status);
  statusRef.current = status;
  const bombsRef = useRef(bombs);
  bombsRef.current = bombs;
  const bombsAvailableRef = useRef(bombsAvailable);
  bombsAvailableRef.current = bombsAvailable;
  const pickupsRef = useRef(pickups);
  pickupsRef.current = pickups;
  const livesRef = useRef(lives);
  livesRef.current = lives;
  const playerDeathRef = useRef(playerDeath);
  playerDeathRef.current = playerDeath;
  const enemiesRef = useRef(enemies);
  enemiesRef.current = enemies;
  const activePowerUpsRef = useRef(activePowerUps);
  activePowerUpsRef.current = activePowerUps;
  const powerUpDropsRef = useRef(powerUpDrops);
  powerUpDropsRef.current = powerUpDrops;
  // where the player is sliding from, and when that slide started
  const playerFromRef = useRef<Pos>(PLAYER_SPAWN);
  const playerMovedAtRef = useRef(0);

  // --- movement: held direction keys drive a fixed-tick walk, same cadence style as
  // enemies, but the first step of a press fires immediately (no tick to wait out) so
  // taps feel instant; holding the key then keeps stepping every PLAYER_MOVE_MS. ---
  const pressedKeysRef = useRef<string[]>([]);
  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);

  const stepPlayer = useCallback((dir: { dx: number; dy: number }) => {
    if (statusRef.current !== "playing") return;
    if (playerDeathRef.current) return; // frozen while the death animation plays
    const p = playerRef.current;
    const nx = p.x + dir.dx;
    const ny = p.y + dir.dy;
    if (gridRef.current[ny]?.[nx] !== "empty") return;
    // record the slide (and keep the ref current) so contact tests can work out
    // where the player actually is mid-glide
    playerFromRef.current = { x: p.x, y: p.y };
    playerMovedAtRef.current = Date.now();
    playerRef.current = { x: nx, y: ny };
    setPlayer({ x: nx, y: ny });
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
    if (playerDeathRef.current) return; // no bombing from beyond the grave
    if (bombsAvailableRef.current <= 0) return;
    const p = playerRef.current;
    if (bombsRef.current.some((b) => b.x === p.x && b.y === p.y)) return;
    idCounter.current += 1;
    setBombs((bs) => [...bs, { x: p.x, y: p.y, id: idCounter.current, placedAt: Date.now() }]);
    setBombsAvailable((n) => n - 1);
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

  // Starts the death animation. The heart is spent immediately (so the HUD
  // reacts at the moment of impact), but respawn / game-over is deferred until
  // the animation finishes -- see the death sweeper effect below.
  const hitPlayer = useCallback((cause: DeathCause) => {
    if (statusRef.current !== "playing") return;
    if (playerDeathRef.current) return; // already dying; ignore further hits
    if (hasPowerUp(activePowerUpsRef.current, "invincible")) return; // shrugged off
    const death = { cause, startedAt: Date.now() };
    playerDeathRef.current = death; // set synchronously so same-tick hits bail out
    setPlayerDeath(death);
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
    setLives((l) => Math.max(l - 1, 0));
  }, []);

  const detonate = useCallback((bx: number, by: number) => {
    // Footprint first, as a pure computation off the live grid -- see blast.ts
    // for why this must not happen inside a state updater. The pierce power-up
    // widens the blast and lets each arm break a second crate.
    const shape = blastShapeFor(hasPowerUp(activePowerUpsRef.current, "pierce"));
    const { cells, destroyed } = computeBlast(
      gridRef.current,
      bx,
      by,
      shape.range,
      shape.crates
    );

    if (destroyed.length > 0) {
      // Keep the ref in step synchronously so a second bomb detonating in this
      // same tick sees the crates this one just cleared.
      const nextGrid = clearCrates(gridRef.current, destroyed);
      gridRef.current = nextGrid;
      setGrid(nextGrid);
    }

    idCounter.current += 1;
    const expId = idCounter.current;
    // clear once the furthest arm has finished igniting, whatever the blast size
    const lastIgnition = cells.reduce((max, c) => Math.max(max, c.delay), 0);
    setExplosions((ex) => [...ex, { cells, id: expId }]);
    setTimeout(() => {
      setExplosions((ex) => ex.filter((e) => e.id !== expId));
    }, EXPLOSION_MS + lastIgnition);

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

      // A thick smoke layer rises behind the fire and lingers after it dies.
      const smokeCount = 7 + Math.floor(Math.random() * 4);
      for (let i = 0; i < smokeCount; i++) {
        idCounter.current += 1;
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 24;
        newParticles.push({
          id: idCounter.current,
          x: cx + (Math.random() - 0.5) * 18,
          y: cy + (Math.random() - 0.5) * 18,
          tx: Math.cos(angle) * dist,
          ty: -14 - Math.random() * 34,
          size: 9 + Math.random() * 13,
          color: smokeColors[Math.floor(Math.random() * smokeColors.length)],
          delay: c.delay + 80 + Math.random() * 220,
          duration: 780 + Math.random() * 520,
          shape: "smoke",
          rotation: (Math.random() - 0.5) * 35,
        });
      }

      // Crate debris, tuned per break variant so each crate throws its pieces
      // around differently (shatter flings wide, crumble drops in a dusty heap,
      // burst launches upward, splinter sprays sideways).
      if (c.wasBrick) {
        const spec = crateDebrisSpec(crateVariantFor(c.x, c.y));
        for (let i = 0; i < spec.chunkCount; i++) {
          idCounter.current += 1;
          const angle = (Math.PI * 2 * i) / spec.chunkCount + Math.random() * 0.5;
          const dist = spec.distMin + Math.random() * (spec.distMax - spec.distMin);
          newParticles.push({
            id: idCounter.current,
            x: cx,
            y: cy,
            tx: Math.cos(angle) * dist,
            ty: Math.sin(angle) * dist + spec.riseBias + Math.random() * 8,
            size: spec.sizeMin + Math.random() * (spec.sizeMax - spec.sizeMin),
            color: brickColors[Math.floor(Math.random() * brickColors.length)],
            delay: c.delay + Math.random() * 35,
            duration: 520 + Math.random() * 320,
            shape: "chunk",
            rotation: (Math.random() - 0.5) * spec.spin,
          });
        }
        // dust kicked up by the crate itself
        for (let i = 0; i < spec.dustCount; i++) {
          idCounter.current += 1;
          const angle = Math.random() * Math.PI * 2;
          newParticles.push({
            id: idCounter.current,
            x: cx + (Math.random() - 0.5) * 16,
            y: cy + (Math.random() - 0.5) * 16,
            tx: Math.cos(angle) * (6 + Math.random() * 14),
            ty: -spec.dustRise * (0.5 + Math.random()),
            size: 6 + Math.random() * 8,
            color: smokeColors[Math.floor(Math.random() * smokeColors.length)],
            delay: c.delay + Math.random() * 90,
            duration: 520 + Math.random() * 320,
            shape: "smoke",
            rotation: 0,
          });
        }
      }
    });
    const particleIds = new Set(newParticles.map((p) => p.id));
    setParticles((ps) => [...ps, ...newParticles]);
    // Retire them only once the longest-lived one has actually finished, rather
    // than on a fixed guess -- the thicker smoke now outlives the old constant.
    const particleLifetime = newParticles.reduce(
      (max, p) => Math.max(max, p.delay + p.duration),
      0
    );
    setTimeout(() => {
      setParticles((ps) => ps.filter((p) => !particleIds.has(p.id)));
    }, particleLifetime + 80);

    // Crates break apart on their own little timeline, in sync with the flame
    // reaching each tile.
    const newBreaks: CrateBreak[] = cells
      .filter((c) => c.wasBrick)
      .map((c) => {
        idCounter.current += 1;
        return {
          x: c.x,
          y: c.y,
          id: idCounter.current,
          variant: crateVariantFor(c.x, c.y),
          delay: c.delay,
        };
      });
    if (newBreaks.length > 0) {
      const breakIds = new Set(newBreaks.map((b) => b.id));
      setCrateBreaks((cbs) => [...cbs, ...newBreaks]);
      const breakLifetime = newBreaks.reduce(
        (max, b) => Math.max(max, b.delay + CRATE_BREAK_MS),
        0
      );
      setTimeout(() => {
        setCrateBreaks((cbs) => cbs.filter((cb) => !breakIds.has(cb.id)));
      }, breakLifetime + 80);
    }

    // power-up drops caught in the fire are lost, same as bomb pickups
    const survivingDrops = powerUpDropsRef.current.filter(
      (d) => !cells.some((c) => c.x === d.x && c.y === d.y)
    );
    if (survivingDrops.length !== powerUpDropsRef.current.length) {
      powerUpDropsRef.current = survivingDrops;
      setPowerUpDrops(survivingDrops);
    }

    // check player hit -- caught in a blast means incineration
    const p = playerRef.current;
    if (!playerDeathRef.current && cells.some((c) => c.x === p.x && c.y === p.y)) {
      hitPlayer("burn");
    }
    // enemies caught in the blast start incinerating; the sweeper removes them
    // once the animation has run its course
    const killedAt = Date.now();
    setEnemies((es) =>
      es.map((en) =>
        en.state === "alive" && cells.some((c) => c.x === en.x && c.y === en.y)
          ? { ...en, state: "dying" as const, dyingSince: killedAt }
          : en
      )
    );

    // Any pickup standing in this blast is consumed by the fire -- work out the
    // survivors first, because that determines whether the player is about to be
    // left with no way of ever getting another bomb.
    const survivingPickups = pickupsRef.current.filter(
      (pk) => !cells.some((c) => c.x === pk.x && c.y === pk.y)
    );

    // Roll for drops, including the guaranteed one when the player would
    // otherwise be left with no way of ever getting another bomb.
    const newPickups: Pickup[] = choosePickupSpots({
      brickCells: cells.filter((c) => c.wasBrick),
      survivingPickupCount: survivingPickups.length,
      bombsAvailable: bombsAvailableRef.current,
    }).map((spot) => {
      idCounter.current += 1;
      return { x: spot.x, y: spot.y, id: idCounter.current };
    });

    // Keep the ref in step synchronously: several bombs can detonate within the
    // same tick, and each needs to see what the previous one already dropped.
    const nextPickups = [...survivingPickups, ...newPickups];
    pickupsRef.current = nextPickups;
    setPickups(nextPickups);
  }, []);

  // --- bomb fuse -> explosion ---
  // detonate() is deliberately called outside any state updater: updaters must be
  // pure, and StrictMode double-invokes them, which previously fired every blast
  // twice. Ready bombs are pulled from the ref and cleared synchronously so the
  // next 100ms tick can't detonate the same bomb again.
  useEffect(() => {
    if (bombs.length === 0) return;
    const t = setInterval(() => {
      const now = Date.now();
      const ready = bombsRef.current.filter((b) => now - b.placedAt >= BOMB_FUSE_MS);
      if (ready.length === 0) return;
      const readyIds = new Set(ready.map((b) => b.id));
      bombsRef.current = bombsRef.current.filter((b) => !readyIds.has(b.id));
      setBombs((bs) => bs.filter((b) => !readyIds.has(b.id)));
      ready.forEach((b) => detonate(b.x, b.y));
    }, 100);
    return () => clearInterval(t);
  }, [bombs.length, detonate]);

  // --- enemy AI: momentum patrol that hunts a quarter of the time ---
  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => {
      // snapshot the world once per tick; the moves themselves are pure
      const steppedAt = Date.now();
      const grid = gridRef.current;
      const liveBombs = bombsRef.current;
      const target = playerRef.current;
      const isOpen = (x: number, y: number) =>
        grid[y]?.[x] === "empty" && !liveBombs.some((b) => b.x === x && b.y === y);

      setEnemies((es) =>
        es.map((en) => {
          if (en.state !== "alive") return en; // dying enemies burn where they stand
          const step = chooseEnemyMove({
            pos: { x: en.x, y: en.y },
            facing: en.facing,
            target,
            isOpen,
          });
          if (!step) return en; // walled in
          return {
            ...en,
            x: en.x + step.dx,
            y: en.y + step.dy,
            facing: step,
            fromX: en.x,
            fromY: en.y,
            movedAt: steppedAt,
          };
        })
      );
    }, ENEMY_MOVE_MS);
    return () => clearInterval(t);
  }, [status]);

  // --- contact check: enemy catches player ---
  // Polled rather than run off state changes, because both parties glide between
  // tiles: contact happens partway through a slide, not at the instant the
  // logical tile changes. See collision.ts.
  useEffect(() => {
    if (status !== "playing") return;
    const t = setInterval(() => {
      if (playerDeathRef.current) return;
      const stamp = Date.now();
      const here = tweenPos(
        playerFromRef.current,
        playerRef.current,
        playerMovedAtRef.current,
        PLAYER_MOVE_MS,
        stamp
      );
      for (const en of enemiesRef.current) {
        if (en.state !== "alive") continue;
        const there = tweenPos(
          { x: en.fromX, y: en.fromY },
          { x: en.x, y: en.y },
          en.movedAt,
          ENEMY_MOVE_MS,
          stamp
        );
        if (isCaught(here, there)) {
          hitPlayer("hit");
          break;
        }
      }
    }, 40);
    return () => clearInterval(t);
  }, [status, hitPlayer]);

  // --- collision check: player picks up a bomb pickup ---
  useEffect(() => {
    if (status !== "playing") return;
    const hit = pickups.find((pk) => pk.x === player.x && pk.y === player.y);
    if (!hit) return;
    // tops up ammo, but never past the fixed 3-bomb cap
    setBombsAvailable((n) => Math.min(n + 1, MAX_BOMBS));
    setPickups((ps) => ps.filter((pk) => pk.id !== hit.id));
  }, [player, pickups, status]);

  // --- collision check: player walks over a power-up drop ---
  useEffect(() => {
    if (status !== "playing") return;
    const hit = powerUpDrops.find((d) => d.x === player.x && d.y === player.y);
    if (!hit) return;
    setActivePowerUps((active) => applyPowerUp(active, hit.kind, Date.now()));
    setPowerUpDrops((ds) => ds.filter((d) => d.id !== hit.id));
  }, [player, powerUpDrops, status]);

  // --- power-up clock: counts the header down and retires anything expired ---
  const hasTimers = powerUpDrops.length > 0 || activePowerUps.length > 0;
  useEffect(() => {
    if (!hasTimers) return;
    const t = setInterval(() => {
      const stamp = Date.now();
      setNow(stamp);
      setPowerUpDrops((ds) => {
        const next = ds.filter((d) => d.expiresAt > stamp);
        return next.length === ds.length ? ds : next;
      });
      setActivePowerUps((as) => {
        const next = as.filter((a) => a.expiresAt > stamp);
        return next.length === as.length ? as : next;
      });
    }, 250);
    return () => clearInterval(t);
  }, [hasTimers]);

  // --- soft-lock rescue ---
  // A blast that breaks no crate yields no pickup, so it is possible to spend
  // the last bomb and be left with no bombs, none ticking, and nothing on the
  // floor to collect -- an unwinnable position. Sit in that state for a few
  // seconds and the game hands over a single bomb to get moving again.
  const isStranded =
    status === "playing" &&
    !playerDeath &&
    bombsAvailable === 0 &&
    bombs.length === 0 &&
    pickups.length === 0;

  useEffect(() => {
    if (!isStranded) return;
    const t = setTimeout(() => {
      // exactly one bomb, and only if still empty-handed when the timer lands
      setBombsAvailable((n) => (n === 0 ? 1 : n));
      setRescueNotice(Date.now());
    }, SOFTLOCK_RESCUE_MS);
    return () => clearTimeout(t);
  }, [isStranded]);

  useEffect(() => {
    if (rescueNotice === null) return;
    const t = setTimeout(() => setRescueNotice(null), RESCUE_NOTICE_MS);
    return () => clearTimeout(t);
  }, [rescueNotice]);

  // --- win check: hold off until every incineration has finished so the
  // victory overlay doesn't cover the last enemy's death animation ---
  useEffect(() => {
    if (status !== "playing") return;
    if (playerDeath) return;
    if (enemies.every((e) => e.state === "dead")) {
      setStatus("won");
    }
  }, [enemies, status, playerDeath]);

  // --- death sweeper: retires finished death animations ---
  // Only runs while something is actually dying. Driven off timestamps rather
  // than per-death setTimeouts so a restart can't leave stale timers pending.
  const hasDyingEnemy = enemies.some((e) => e.state === "dying");
  useEffect(() => {
    if (!playerDeath && !hasDyingEnemy) return;
    const t = setInterval(() => {
      const now = Date.now();

      // Work out who has finished burning up front, so the drop roll happens
      // out here rather than inside the updater (updaters must stay pure, and
      // StrictMode double-invokes them -- which would double the drops).
      const finished = enemiesRef.current.filter(
        (en) =>
          en.state === "dying" &&
          en.dyingSince !== null &&
          now - en.dyingSince >= DEATH_ANIM_MS
      );
      if (finished.length > 0) {
        const doneIds = new Set(finished.map((en) => en.id));
        setEnemies((es) =>
          es.map((en) =>
            doneIds.has(en.id)
              ? { ...en, state: "dead" as const, dyingSince: null }
              : en
          )
        );

        // a third of them leave a power-up behind
        const drops: PowerUpDrop[] = [];
        for (const en of finished) {
          const kind = rollEnemyDrop();
          if (!kind) continue;
          idCounter.current += 1;
          drops.push({
            id: idCounter.current,
            x: en.x,
            y: en.y,
            kind,
            expiresAt: now + POWERUP_MS,
          });
        }
        if (drops.length > 0) {
          const nextDrops = [...powerUpDropsRef.current, ...drops];
          powerUpDropsRef.current = nextDrops;
          setPowerUpDrops(nextDrops);
        }
      }

      const death = playerDeathRef.current;
      if (death && now - death.startedAt >= DEATH_ANIM_MS) {
        playerDeathRef.current = null;
        setPlayerDeath(null);
        if (livesRef.current <= 0) {
          setStatus("lost");
        } else {
          // teleport home: no slide, so contact tests don't tween across the board
          playerRef.current = PLAYER_SPAWN;
          playerFromRef.current = PLAYER_SPAWN;
          playerMovedAtRef.current = 0;
          setPlayer(PLAYER_SPAWN);
          setRespawnKey((k) => k + 1);
        }
      }
    }, 80);
    return () => clearInterval(t);
  }, [playerDeath, hasDyingEnemy]);

  const restart = useCallback(() => {
    const newGrid = makeGrid();
    setGrid(newGrid);
    playerRef.current = PLAYER_SPAWN;
    playerFromRef.current = PLAYER_SPAWN;
    playerMovedAtRef.current = 0;
    setPlayer(PLAYER_SPAWN);
    setEnemies(makeEnemies(newGrid));
    setBombs([]);
    setBombsAvailable(MAX_BOMBS);
    setPickups([]);
    setCrateBreaks([]);
    setPowerUpDrops([]);
    setActivePowerUps([]);
    setRescueNotice(null);
    setExplosions([]);
    setLives(3);
    playerDeathRef.current = null;
    setPlayerDeath(null);
    setRespawnKey((k) => k + 1);
    setStatus("playing");
  }, []);

  return {
    grid,
    player,
    enemies,
    bombs,
    bombsAvailable,
    pickups,
    crateBreaks,
    powerUpDrops,
    activePowerUps,
    now,
    rescueNotice,
    explosions,
    particles,
    lives,
    status,
    flash,
    playerDeath,
    respawnKey,
    restart,
  };
}
