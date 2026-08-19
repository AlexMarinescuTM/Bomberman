import React from "react";
import "@fontsource/press-start-2p";
import {
  BOMB_FUSE_MS,
  CELL,
  COLS,
  DEATH_ANIM_MS,
  ENEMY_MOVE_MS,
  MAX_BOMBS,
  PLAYER_MOVE_MS,
  ROWS,
} from "./bomberman.types";
import type { ExplosionCell } from "./bomberman.types";
import { useBombermanGame } from "./useBombermanGame";
import { CRATE_BREAK_MS, crateShards } from "./crateBreaks";
import type { CrateBreak } from "./crateBreaks";
import { POWERUP_LABEL, secondsLeft } from "./powerUps";
import type { PowerUpKind } from "./powerUps";
import {
  BLAST_ICON_COLORS,
  BLAST_ICON_SPRITE,
  BOMB_COLORS,
  BOMB_FUSE_FRAMES,
  BOMB_SPRITE,
  STAR_COLORS,
  STAR_SPRITE,
  ENEMY_COLORS,
  ENEMY_IDLE_FRAMES,
  ENEMY_IDLE_MS,
  ENEMY_SPRITE,
  HEART_COLORS,
  HEART_COLORS_DIM,
  HEART_SPRITE,
  PAL,
  PICKUP_COLORS,
  PICKUP_SPRITE,
  PIXEL_FONT,
  PLAYER_COLORS,
  PLAYER_IDLE_FRAMES,
  PLAYER_IDLE_MS,
  brickTileStyle,
  floorTileStyle,
  wallTileStyle,
} from "./pixelArt";
import { AnimatedPixelSprite, PixelSprite } from "./PixelSprite";

// Entities are drawn at 2x the 16px sprite grid so every pixel lands on a whole
// screen pixel; the 4px margin centres that 32px sprite inside a 40px tile.
const SPRITE_PX = 32;
const SPRITE_INSET = (CELL - SPRITE_PX) / 2;

// Hard-banded fireball -- concentric rings with no soft falloff anywhere.
const BLAST_FILL = `radial-gradient(circle, ${PAL.fire0} 0 20%, ${PAL.fire1} 20% 42%, ${PAL.fire2} 42% 64%, ${PAL.fire3} 64% 84%, transparent 84%)`;

function panelStyle(): React.CSSProperties {
  return {
    background: PAL.panel,
    boxShadow: [
      `inset 0 0 0 1px ${PAL.ink}`,
      `inset 3px 3px 0 ${PAL.panelHi}`,
      `inset -3px -3px 0 ${PAL.panelLo}`,
    ].join(", "),
  };
}

const POWERUP_ART: Record<
  PowerUpKind,
  { rows: readonly string[]; palette: Record<string, string>; glow: string }
> = {
  invincible: { rows: STAR_SPRITE, palette: STAR_COLORS, glow: PAL.gold },
  pierce: { rows: BLAST_ICON_SPRITE, palette: BLAST_ICON_COLORS, glow: PAL.fire2 },
};

/** One header slot: an icon, a label and the seconds ticking down beside it. */
function PowerUpChip({
  kind,
  seconds,
  active,
}: {
  kind: PowerUpKind;
  seconds: number;
  active: boolean;
}) {
  const art = POWERUP_ART[kind];
  // running low reads red whether it's a drop about to vanish or an effect about to lapse
  const urgent = seconds <= 5;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 6px",
        fontSize: 8,
        opacity: active ? 1 : 0.75,
        boxShadow: `inset 0 0 0 1px ${active ? art.glow : PAL.panelHi}`,
        animation: urgent ? "px-urgent 400ms steps(2) infinite alternate" : undefined,
      }}
    >
      <PixelSprite rows={art.rows} palette={art.palette} size={14} />
      <span style={{ color: active ? art.glow : PAL.uiDim }}>
        {active ? POWERUP_LABEL[kind] : "DROP"}
      </span>
      <span style={{ color: urgent ? PAL.red : PAL.ui }}>{seconds}</span>
    </div>
  );
}

// Chunky embers that lick upward off whatever is being incinerated. Fixed
// offsets and staggered delays keep it deterministic and cheap; the loop is
// short enough to repeat a few times across the death animation.
const EMBERS = [
  { x: 7, y: 24, size: 6, color: PAL.fire1, delay: 0 },
  { x: 17, y: 28, size: 5, color: PAL.fire2, delay: 170 },
  { x: 25, y: 22, size: 6, color: PAL.fire1, delay: 330 },
  { x: 12, y: 20, size: 4, color: PAL.fire0, delay: 500 },
  { x: 21, y: 30, size: 5, color: PAL.fire3, delay: 250 },
  { x: 29, y: 27, size: 4, color: PAL.fire2, delay: 620 },
];

// A crate coming apart: four quadrant shards, each flying off along the path
// its variant dictates. Same bevelled brick colours as the intact tile so the
// pieces read as bits of the crate rather than generic debris.
function CrateShards({ cb }: { cb: CrateBreak }) {
  const half = CELL / 2;
  return (
    <div
      style={{
        position: "absolute",
        left: cb.x * CELL,
        top: cb.y * CELL,
        width: CELL,
        height: CELL,
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      {crateShards(cb.variant).map((s, i) => (
        <div
          key={i}
          style={
            {
              position: "absolute",
              left: s.qx * half,
              top: s.qy * half,
              width: half,
              height: half,
              background: PAL.brickMid,
              boxShadow: [
                `inset 0 0 0 1px ${PAL.brickInk}`,
                `inset 2px 2px 0 ${PAL.brickHi}`,
                `inset -2px -2px 0 ${PAL.brickLo}`,
              ].join(", "),
              animation: `crate-${cb.variant} ${CRATE_BREAK_MS}ms steps(6) ${cb.delay}ms forwards`,
              "--sx": `${s.sx}px`,
              "--sy": `${s.sy}px`,
              "--sr": `${s.sr}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function EmberPlume({ left, top }: { left: number; top: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: CELL,
        height: CELL,
        pointerEvents: "none",
        zIndex: 7,
      }}
    >
      {EMBERS.map((e, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: e.x,
            top: e.y,
            width: e.size,
            height: e.size,
            background: e.color,
            animation: `px-ember 760ms steps(4) ${e.delay}ms infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default function Bomberman() {
  const {
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
    roundKey,
    restart,
  } = useBombermanGame();

  const isInvincible = activePowerUps.some((a) => a.kind === "invincible");

  const explodedMap = new Map<string, ExplosionCell>();
  explosions.forEach((e) =>
    e.cells.forEach((c) => explodedMap.set(`${c.x},${c.y}`, c))
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: 24,
        background: PAL.void,
        fontFamily: PIXEL_FONT,
        color: PAL.ui,
        width: "fit-content",
        imageRendering: "pixelated",
        boxShadow: `0 0 0 4px ${PAL.panelHi}, 0 0 0 8px ${PAL.ink}`,
      }}
    >
      {/* ---- title ---- */}
      <h1
        style={{
          fontSize: 16,
          lineHeight: 1.4,
          letterSpacing: 2,
          margin: 0,
          color: PAL.gold,
          textShadow: `3px 3px 0 ${PAL.ink}`,
        }}
      >
        BOMBER GRID
      </h1>

      {/* ---- HUD ---- */}
      <div
        style={{
          ...panelStyle(),
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "10px 14px",
          width: COLS * CELL - 8,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <PixelSprite
              key={i}
              rows={HEART_SPRITE}
              palette={i < lives ? HEART_COLORS : HEART_COLORS_DIM}
              size={16}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 8 }}>
          <PixelSprite rows={BOMB_SPRITE} palette={BOMB_COLORS} size={18} />
          <span style={{ color: bombsAvailable === 0 ? PAL.red : PAL.ui }}>
            {bombsAvailable}/{MAX_BOMBS}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 8, marginLeft: "auto" }}>
          <PixelSprite rows={ENEMY_SPRITE} palette={ENEMY_COLORS} size={18} />
          <span>{enemies.filter((e) => e.state === "alive").length}</span>
        </div>
      </div>

      {/* ---- power-ups: drops waiting on the floor and effects in hand, both
           counting down in the same strip ---- */}
      {(powerUpDrops.length > 0 || activePowerUps.length > 0) && (
        <div
          style={{
            ...panelStyle(),
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            width: COLS * CELL - 8,
            boxSizing: "border-box",
            flexWrap: "wrap",
          }}
        >
          {activePowerUps.map((a) => (
            <PowerUpChip
              key={`active-${a.kind}`}
              kind={a.kind}
              seconds={secondsLeft(a.expiresAt, now)}
              active
            />
          ))}
          {powerUpDrops.map((d) => (
            <PowerUpChip
              key={`drop-${d.id}`}
              kind={d.kind}
              seconds={secondsLeft(d.expiresAt, now)}
              active={false}
            />
          ))}
        </div>
      )}

      {/* ---- board ---- */}
      <div
        style={{
          position: "relative",
          width: COLS * CELL,
          height: ROWS * CELL,
          background: PAL.floorB,
          overflow: "hidden",
          boxShadow: flash
            ? `0 0 0 4px ${PAL.red}, 0 0 0 8px ${PAL.ink}`
            : `0 0 0 4px ${PAL.panelHi}, 0 0 0 8px ${PAL.ink}`,
        }}
      >
        {/* tiles */}
        {grid.map((row, y) =>
          row.map((cell, x) => {
            const key = `${x},${y}`;
            const blast = explodedMap.get(key);
            const tile =
              cell === "wall"
                ? wallTileStyle()
                : cell === "brick"
                  ? brickTileStyle()
                  : floorTileStyle(x, y);
            return (
              <React.Fragment key={key}>
                <div
                  style={{
                    position: "absolute",
                    left: x * CELL,
                    top: y * CELL,
                    width: CELL,
                    height: CELL,
                    boxSizing: "border-box",
                    ...tile,
                  }}
                />
                {blast && (
                  <div
                    key={`${key}-${blast.delay}`}
                    style={
                      {
                        position: "absolute",
                        left: x * CELL,
                        top: y * CELL,
                        width: CELL,
                        height: CELL,
                        pointerEvents: "none",
                        zIndex: 4,
                        opacity: 0,
                        background: BLAST_FILL,
                        animation: `px-blast 400ms steps(4) ${blast.delay}ms forwards`,
                      } as React.CSSProperties
                    }
                  />
                )}
              </React.Fragment>
            );
          })
        )}

        {/* crates coming apart */}
        {crateBreaks.map((cb) => (
          <CrateShards key={cb.id} cb={cb} />
        ))}

        {/* bombs */}
        {bombs.map((b) => (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: b.x * CELL + SPRITE_INSET,
              top: b.y * CELL + SPRITE_INSET,
              zIndex: 2,
              animation: "px-bomb 500ms steps(2) infinite alternate",
            }}
          >
            {/* the fuse burns down across the bomb's whole fuse time, so the
                spark reaching the cap lines up with it going off */}
            <AnimatedPixelSprite
              frames={BOMB_FUSE_FRAMES}
              palette={BOMB_COLORS}
              size={SPRITE_PX}
              durationMs={BOMB_FUSE_MS}
              loop={false}
            />
          </div>
        ))}

        {/* power-up drops */}
        {powerUpDrops.map((d) => {
          const art = POWERUP_ART[d.kind];
          const expiring = secondsLeft(d.expiresAt, now) <= 5;
          return (
            <div
              key={d.id}
              style={{
                position: "absolute",
                left: d.x * CELL + SPRITE_INSET,
                top: d.y * CELL + SPRITE_INSET,
                zIndex: 1,
                filter: `drop-shadow(0 0 5px ${art.glow})`,
                // blinks out as its 30s runs down, so you know to hurry
                animation: expiring
                  ? "px-urgent 260ms steps(2) infinite alternate"
                  : "px-bob 640ms steps(2) infinite alternate",
              }}
            >
              <PixelSprite rows={art.rows} palette={art.palette} size={SPRITE_PX} />
            </div>
          );
        })}

        {/* bomb pickups */}
        {pickups.map((pk) => (
          <div
            key={pk.id}
            style={{
              position: "absolute",
              left: pk.x * CELL + SPRITE_INSET,
              top: pk.y * CELL + SPRITE_INSET,
              zIndex: 1,
              animation: "px-bob 640ms steps(2) infinite alternate",
            }}
          >
            <PixelSprite rows={PICKUP_SPRITE} palette={PICKUP_COLORS} size={SPRITE_PX} />
          </div>
        ))}

        {/* enemies -- "dying" ones stay on screen to burn away */}
        {enemies
          .filter((e) => e.state !== "dead")
          .map((e) => {
            const burning = e.state === "dying";
            return (
              // keyed by round as well as id: enemy ids repeat every round, so
              // without this the reused DOM node would glide from last round's
              // position to the new spawn instead of just appearing there
              <React.Fragment key={`${roundKey}-${e.id}`}>
                <div
                  style={{
                    position: "absolute",
                    left: e.x * CELL + SPRITE_INSET,
                    top: e.y * CELL + SPRITE_INSET,
                    zIndex: 3,
                    transformOrigin: "50% 100%",
                    transition: burning
                      ? "none"
                      : `left ${ENEMY_MOVE_MS}ms linear, top ${ENEMY_MOVE_MS}ms linear`,
                    animation: burning
                      ? `px-incinerate ${DEATH_ANIM_MS}ms steps(10) forwards`
                      : undefined,
                  }}
                >
                  <AnimatedPixelSprite
                    frames={ENEMY_IDLE_FRAMES}
                    palette={ENEMY_COLORS}
                    size={SPRITE_PX}
                    durationMs={ENEMY_IDLE_MS}
                    paused={burning}
                  />
                </div>
                {burning && <EmberPlume left={e.x * CELL} top={e.y * CELL} />}
              </React.Fragment>
            );
          })}

        {/* player -- respawnKey remounts the sprite so returning to spawn snaps
            instead of sliding along the movement transition */}
        <div
          key={respawnKey}
          style={{
            position: "absolute",
            left: player.x * CELL + SPRITE_INSET,
            top: player.y * CELL + SPRITE_INSET,
            zIndex: 5,
            transformOrigin: "50% 100%",
            transition: playerDeath
              ? "none"
              : `left ${PLAYER_MOVE_MS}ms linear, top ${PLAYER_MOVE_MS}ms linear`,
            animation: playerDeath
              ? `${playerDeath.cause === "burn" ? "px-incinerate" : "px-struck"} ${DEATH_ANIM_MS}ms steps(10) forwards`
              : isInvincible
                ? "px-invincible 320ms steps(2) infinite alternate"
                : undefined,
          }}
        >
          <AnimatedPixelSprite
            frames={PLAYER_IDLE_FRAMES}
            palette={PLAYER_COLORS}
            size={SPRITE_PX}
            durationMs={PLAYER_IDLE_MS}
            paused={playerDeath !== null}
          />
        </div>
        {playerDeath?.cause === "burn" && (
          <EmberPlume left={player.x * CELL} top={player.y * CELL} />
        )}

        {/* explosion debris -- square, unblurred, stepped */}
        {particles.map((p) => {
          const px = Math.max(3, Math.round(p.size / 2) * 2);
          const color =
            p.shape === "smoke"
              ? PAL.smoke
              : p.shape === "chunk"
                ? PAL.brickMid
                : p.color;
          return (
            <div
              key={p.id}
              style={
                {
                  position: "absolute",
                  left: Math.round(p.x),
                  top: Math.round(p.y),
                  width: px,
                  height: px,
                  marginLeft: -px / 2,
                  marginTop: -px / 2,
                  background: color,
                  pointerEvents: "none",
                  zIndex: p.shape === "smoke" ? 3 : 6,
                  animation: `${p.shape === "smoke" ? "px-smoke" : "px-shard"} ${p.duration}ms steps(5) ${p.delay}ms forwards`,
                  "--tx": `${Math.round(p.tx)}px`,
                  "--ty": `${Math.round(p.ty)}px`,
                } as React.CSSProperties
              }
            />
          );
        })}

        {/* soft-lock rescue toast */}
        {rescueNotice !== null && (
          <div
            key={rescueNotice}
            style={{
              ...panelStyle(),
              position: "absolute",
              left: "50%",
              top: 14,
              transform: "translateX(-50%)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 9,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              animation: "px-toast 260ms steps(4) both",
            }}
          >
            <PixelSprite rows={BOMB_SPRITE} palette={BOMB_COLORS} size={20} />
            <div style={{ fontSize: 8, lineHeight: 1.8 }}>
              <div style={{ color: PAL.gold }}>NO WAY OUT</div>
              <div style={{ color: PAL.ui }}>+1 FREE BOMB</div>
            </div>
          </div>
        )}

        {/* CRT scanlines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 8,
            background: `repeating-linear-gradient(0deg, rgba(0,0,0,0.20) 0 1px, transparent 1px 3px)`,
          }}
        />
      </div>

      <div
        style={{
          fontSize: 8,
          lineHeight: 2,
          color: PAL.uiDim,
          textAlign: "center",
        }}
      >
        ARROWS / WASD - MOVE &nbsp;&nbsp; SPACE - BOMB
        <br />
        BLAST THE BRICKS &nbsp;&nbsp; CLEAR THE GRID
      </div>

      {status !== "playing" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,10,18,0.86)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
            zIndex: 10,
            fontFamily: PIXEL_FONT,
          }}
        >
          <div
            style={{
              ...panelStyle(),
              padding: "26px 34px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 22,
            }}
          >
            <div
              style={{
                fontSize: 20,
                lineHeight: 1.5,
                letterSpacing: 2,
                color: status === "won" ? PAL.green : PAL.red,
                textShadow: `3px 3px 0 ${PAL.ink}`,
              }}
            >
              {status === "won" ? "GRID CLEARED" : "GAME OVER"}
            </div>
            <button
              onClick={restart}
              style={{
                padding: "12px 20px",
                fontSize: 10,
                letterSpacing: 1,
                background: PAL.gold,
                color: PAL.ink,
                border: "none",
                borderRadius: 0,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: [
                  `inset 0 0 0 1px ${PAL.ink}`,
                  `inset 3px 3px 0 #ffe98a`,
                  `inset -3px -3px 0 #b8860b`,
                ].join(", "),
              }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes px-bomb {
          from { transform: translateY(0); }
          to   { transform: translateY(-2px); }
        }
        @keyframes px-bob {
          from { transform: translateY(0); }
          to   { transform: translateY(-3px); }
        }
        @keyframes px-blast {
          0%   { opacity: 1; transform: scale(0.35); }
          60%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.2); }
        }
        @keyframes px-shard {
          0%   { opacity: 1; transform: translate(0, 0); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)); }
        }
        @keyframes px-smoke {
          0%   { opacity: 0.75; transform: translate(0, 0); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)); }
        }

        /* Death: burned alive. Flash white, scorch through orange to charcoal,
           then collapse into the floor. */
        @keyframes px-incinerate {
          0%   { filter: none; opacity: 1; transform: scaleY(1); }
          15%  { filter: brightness(6) saturate(0); opacity: 1; transform: scaleY(1.05); }
          35%  { filter: sepia(1) saturate(9) hue-rotate(-20deg) brightness(1.7); transform: scaleY(1); }
          60%  { filter: sepia(1) saturate(9) hue-rotate(-35deg) brightness(1.25); transform: scaleY(0.82); }
          85%  { filter: sepia(1) saturate(6) hue-rotate(-45deg) brightness(0.7); opacity: 0.8; transform: scaleY(0.45); }
          100% { filter: brightness(0.25) saturate(0); opacity: 0; transform: scaleY(0.1); }
        }
        /* Death: caught by an enemy. Hit-flash a few times, topple over, fade. */
        @keyframes px-struck {
          0%   { filter: none; opacity: 1; transform: rotate(0deg); }
          10%  { filter: brightness(6) saturate(0); }
          20%  { filter: none; }
          30%  { filter: brightness(6) saturate(0); }
          40%  { filter: none; transform: rotate(-12deg); }
          50%  { filter: brightness(6) saturate(0); }
          65%  { filter: grayscale(0.6) brightness(0.9); transform: rotate(-45deg); }
          100% { filter: grayscale(1) brightness(0.4); opacity: 0; transform: rotate(-90deg) translateY(6px); }
        }
        @keyframes px-ember {
          0%   { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-20px); }
        }

        /* --- crate destruction, one keyframe per variant --- */
        /* blown apart: pieces fly out diagonally, spinning */
        @keyframes crate-shatter {
          0%   { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translate(var(--sx), var(--sy)) rotate(var(--sr)) scale(0.3); }
        }
        /* collapses: sags, then drops into a flattened heap */
        @keyframes crate-crumble {
          0%   { opacity: 1; transform: translate(0, 0) rotate(0deg) scaleY(1); }
          45%  { opacity: 1; transform: translate(calc(var(--sx) * 0.35), calc(var(--sy) * 0.45)) rotate(calc(var(--sr) * 0.4)) scaleY(0.72); }
          100% { opacity: 0; transform: translate(var(--sx), var(--sy)) rotate(var(--sr)) scaleY(0.12); }
        }
        /* pops: bright flare, swells, then launches upward */
        @keyframes crate-burst {
          0%   { opacity: 1; filter: brightness(2.6); transform: translate(0, 0) scale(1); }
          25%  { opacity: 1; filter: brightness(1.5); transform: translate(calc(var(--sx) * 0.4), calc(var(--sy) * 0.35)) scale(1.18); }
          100% { opacity: 0; filter: brightness(1);   transform: translate(var(--sx), var(--sy)) rotate(var(--sr)) scale(0.28); }
        }
        /* splits: squashes into thin slats that shoot sideways */
        @keyframes crate-splinter {
          0%   { opacity: 1; transform: translate(0, 0) rotate(0deg) scaleX(1); }
          100% { opacity: 0; transform: translate(var(--sx), var(--sy)) rotate(var(--sr)) scaleX(0.18); }
        }

        /* Sprite-sheet stepping: the strip is frames*size wide, so -100% of its
           own width divided into steps(frames) lands exactly one frame per step. */
        @keyframes px-sprite-strip {
          from { transform: translateX(0); }
          to   { transform: translateX(-100%); }
        }

        /* invincible: the classic hard-flashing shield blink */
        @keyframes px-invincible {
          from { filter: none; }
          to   { filter: brightness(2.4) saturate(1.6) drop-shadow(0 0 6px #ffd23d); }
        }
        /* a power-up timer about to run out */
        @keyframes px-urgent {
          from { opacity: 1; }
          to   { opacity: 0.35; }
        }

        @keyframes px-toast {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
