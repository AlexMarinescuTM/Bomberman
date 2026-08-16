import React from "react";
import { CELL, COLS, ENEMY_MOVE_MS, PLAYER_MOVE_MS, ROWS } from "./bomberman.types";
import type { ExplosionCell } from "./bomberman.types";
import { useBombermanGame } from "./useBombermanGame";

export default function Bomberman() {
  const {
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
  } = useBombermanGame();

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
        gap: 14,
        padding: 20,
        background: "radial-gradient(circle at 50% 0%, #1c1f2b 0%, #0b0d14 70%)",
        borderRadius: 16,
        fontFamily: "'Courier New', monospace",
        color: "#e9e4d8",
        width: "fit-content",
        boxShadow: "0 0 0 1px #2a2f42, 0 20px 60px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <h1
          style={{
            fontSize: 22,
            letterSpacing: 3,
            margin: 0,
            color: "#f2b632",
            textShadow: "0 0 12px rgba(242,182,50,0.5)",
          }}
        >
          ⬛ BOMBER GRID
        </h1>
        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} style={{ fontSize: 18, opacity: i < lives ? 1 : 0.2 }}>
              ❤️
            </span>
          ))}
        </div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Enemies left: {enemies.filter((e) => e.alive).length}
        </div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Bombs: {bombs.length}/{maxBombs}
        </div>
      </div>

      <div
        style={{
          position: "relative",
          width: COLS * CELL,
          height: ROWS * CELL,
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.035), transparent 18%), radial-gradient(circle at 50% 20%, #1c2030 0%, #0d1018 72%)",
          border: "3px solid #2a2f42",
          borderRadius: 10,
          boxShadow: flash
            ? "0 0 0 6px rgba(220,60,60,0.6) inset, 0 18px 40px rgba(0,0,0,0.55)"
            : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -14px 28px rgba(0,0,0,0.32), 0 18px 40px rgba(0,0,0,0.45)",
          transition: "box-shadow 0.15s",
          overflow: "hidden",
          transform: "perspective(900px) rotateX(2.5deg)",
          transformOrigin: "50% 100%",

        }}
      >
        {/* grid */}
        {grid.map((row, y) =>
          row.map((cell, x) => {
            const key = `${x},${y}`;
            const blast = explodedMap.get(key);
            let bg = "#181b26";
            if (cell === "wall") bg = "#3a3f52";
            else if (cell === "brick") bg = "#8a5a3b";
            return (
              <React.Fragment key={key}>
                <div
                  style={{
                    position: "absolute",
                    left: x * CELL,
                    top: y * CELL,
                    width: CELL,
                    height: CELL,
                    background: bg,
                    border:
                      cell === "wall"
                        ? "1px solid #4a4f66"
                        : cell === "brick"
                          ? "1px solid #6b4128"
                          : "1px solid #1a1d28",
                    boxSizing: "border-box",
                    backgroundImage:
                      cell === "brick"
                        ? "linear-gradient(145deg, rgba(255,255,255,0.12), transparent 34%), repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0 4px, transparent 4px 10px)"
                        : cell === "wall"
                          ? "linear-gradient(145deg, rgba(255,255,255,0.14), transparent 42%), linear-gradient(135deg, #4b5167, #292d3d)"
                          : "linear-gradient(145deg, rgba(255,255,255,0.025), transparent 45%)",
                    boxShadow:
                      cell === "wall"
                        ? "inset 0 1px 0 rgba(255,255,255,0.12), inset -3px -4px 0 rgba(0,0,0,0.22)"
                        : cell === "brick"
                          ? "inset 0 1px 0 rgba(255,232,190,0.16), inset -3px -4px 0 rgba(62,33,20,0.24)"
                          : "inset 0 1px 0 rgba(255,255,255,0.03)",
                  }}
                >
                  {cell !== "empty" && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          width: "100%",
                          height: 5,
                          background:
                            cell === "wall"
                              ? "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0))"
                              : "linear-gradient(180deg, rgba(255,218,166,0.22), rgba(255,218,166,0))",
                          pointerEvents: "none",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          right: -1,
                          top: 4,
                          width: 4,
                          height: "calc(100% - 4px)",
                          background:
                            cell === "wall"
                              ? "linear-gradient(180deg, #232736, #151821)"
                              : "linear-gradient(180deg, #5b341f, #392015)",
                          boxShadow: "inset 1px 0 rgba(0,0,0,0.18)",
                          pointerEvents: "none",
                        }}
                      />
                    </>
                  )}
                </div>
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
                        animation: `bomberman-blast 380ms ease-out ${blast.delay}ms forwards`,
                      } as React.CSSProperties
                    }
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: "8%",
                        borderRadius: "50%",
                        background:
                          "radial-gradient(circle, #ffffff 0%, #fff6d8 18%, #ffcf6b 42%, #ff8a3c 65%, rgba(255,90,30,0) 76%)",
                        mixBlendMode: "screen",
                        filter: "blur(0.4px)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: "18%",
                        border: "2px solid rgba(255,244,190,0.95)",
                        borderRadius: "50%",
                        boxShadow: "0 0 18px rgba(255,150,55,0.85), inset 0 0 14px rgba(255,208,100,0.75)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: "135%",
                        height: "35%",
                        transform: "translate(-50%, -50%) rotate(-22deg)",
                        borderRadius: "50%",
                        background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,202,90,0.6), rgba(255,255,255,0))",
                        filter: "blur(2px)",
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}

        {/* bombs */}
        {bombs.map((b) => (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: b.x * CELL + CELL * 0.18,
              top: b.y * CELL + CELL * 0.18,
              width: CELL * 0.64,
              height: CELL * 0.64,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 32% 24%, #a8a8a8 0%, #555 22%, #202020 58%, #070707 100%)",
              boxShadow:
                "inset -4px -6px 8px rgba(0,0,0,0.65), inset 3px 3px 5px rgba(255,255,255,0.22), 0 6px 10px rgba(0,0,0,0.45), 0 0 14px rgba(255,80,0,0.55)",
              animation: "bomberman-pulse 0.5s infinite alternate",
              transform: "translateZ(4px)",
            }}
          />
        ))}

        {/* bomb pickups */}
        {pickups.map((pk) => (
          <div
            key={pk.id}
            style={{
              position: "absolute",
              left: pk.x * CELL + CELL * 0.2,
              top: pk.y * CELL + CELL * 0.2,
              width: CELL * 0.6,
              height: CELL * 0.6,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 32% 24%, #8a8a8a 0%, #4a4a4a 22%, #1c1c1c 58%, #070707 100%)",
              boxShadow:
                "inset -3px -4px 6px rgba(0,0,0,0.6), inset 2px 2px 4px rgba(255,255,255,0.2), 0 4px 8px rgba(0,0,0,0.4), 0 0 12px rgba(120,230,150,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "bomberman-pulse 0.7s infinite alternate",
            }}
          >
            <span
              style={{
                fontSize: CELL * 0.34,
                fontWeight: "bold",
                color: "#8effa5",
                textShadow: "0 0 6px rgba(142,255,165,0.9)",
              }}
            >
              +
            </span>
          </div>
        ))}

        {/* enemies */}
        {enemies
          .filter((e) => e.alive)
          .map((e) => (
            <div
              key={e.id}
              style={{
                position: "absolute",
                left: e.x * CELL + CELL * 0.12,
                top: e.y * CELL + CELL * 0.12,
                width: CELL * 0.76,
                height: CELL * 0.76,
                borderRadius: "30% 30% 50% 50%",
                background:
                  "radial-gradient(circle at 34% 24%, #ff9494 0%, #e14b4b 28%, #a11f1f 68%, #661515 100%)",
                boxShadow:
                  "inset -4px -5px 7px rgba(80,0,0,0.35), inset 3px 3px 5px rgba(255,255,255,0.16), 0 6px 8px rgba(0,0,0,0.38), 0 0 8px rgba(225,75,75,0.65)",
                transition: `left ${ENEMY_MOVE_MS}ms linear, top ${ENEMY_MOVE_MS}ms linear`,
                transform: "translateZ(3px)",
              }}
            />
          ))}

        {/* player */}
        <div
          style={{
            position: "absolute",
            left: player.x * CELL + CELL * 0.12,
            top: player.y * CELL + CELL * 0.12,
            width: CELL * 0.76,
            height: CELL * 0.76,
            borderRadius: "50% 50% 30% 30%",
            background:
              "radial-gradient(circle at 34% 22%, #d5f6ff 0%, #5fd0ff 24%, #2286c9 68%, #14507a 100%)",
            boxShadow:
              "inset -4px -6px 7px rgba(0,45,80,0.38), inset 3px 3px 5px rgba(255,255,255,0.24), 0 7px 9px rgba(0,0,0,0.36), 0 0 10px rgba(95,208,255,0.78)",
            transition: `left ${PLAYER_MOVE_MS}ms linear, top ${PLAYER_MOVE_MS}ms linear`,
            zIndex: 2,
            transform: "translateZ(4px)",
          }}
        />

        {/* explosion particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            style={
              {
                position: "absolute",
                left: p.x,
                top: p.y,
                width: p.size,
                height: p.size,
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
                borderRadius:
                  p.shape === "chunk" ? 2 : p.shape === "spark" ? 2 : "50%",
                background:
                  p.shape === "smoke"
                    ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.18), ${p.color} 45%, rgba(0,0,0,0.12) 100%)`
                    : p.shape === "ember"
                      ? `radial-gradient(circle, #fff7d6 0%, ${p.color} 45%, rgba(255,80,20,0) 100%)`
                      : p.shape === "spark"
                        ? `linear-gradient(90deg, rgba(255,255,255,0), ${p.color}, rgba(255,255,255,0))`
                        : p.color,
                boxShadow:
                  p.shape === "chunk"
                    ? "0 2px 3px rgba(0,0,0,0.5), inset 1px 1px rgba(255,255,255,0.14)"
                    : p.shape === "smoke"
                      ? "0 0 10px rgba(60,60,60,0.2)"
                      : `0 0 ${p.size * 1.8}px ${p.color}`,
                pointerEvents: "none",
                zIndex: p.shape === "smoke" ? 3 : 6,
                animation: `${p.shape === "chunk"
                    ? "bomberman-chunk"
                    : p.shape === "smoke"
                      ? "bomberman-smoke"
                      : p.shape === "spark"
                        ? "bomberman-spark"
                        : "bomberman-particle"
                  } ${p.duration}ms ease-out ${p.delay}ms forwards`,
                "--tx": `${p.tx}px`,
                "--ty": `${p.ty}px`,
                "--rot": `${p.rotation}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div style={{ fontSize: 12, opacity: 0.65, textAlign: "center", lineHeight: 1.6 }}>
        Move: Arrow keys / WASD &nbsp;•&nbsp; Bomb: Space<br />
        Destroy brown bricks, avoid red enemies, clear the grid.
      </div>

      {status !== "playing" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5,6,10,0.75)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: "bold",
              color: status === "won" ? "#7ef2a1" : "#ff6b6b",
              textShadow: "0 0 16px currentColor",
            }}
          >
            {status === "won" ? "GRID CLEARED" : "GAME OVER"}
          </div>
          <button
            onClick={restart}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              letterSpacing: 1,
              background: "#f2b632",
              color: "#12141c",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: "bold",
            }}
          >
            PLAY AGAIN
          </button>
        </div>
      )}

      <style>{`
        @keyframes bomberman-pulse {
          from { transform: scale(1); }
          to { transform: scale(1.15); }
        }
        @keyframes bomberman-particle {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0.15);
            opacity: 0;
          }
        }
        @keyframes bomberman-spark {
          0% {
            transform: translate(0, 0) rotate(var(--rot)) scaleX(0.7);
            opacity: 1;
          }
          18% {
            transform: translate(calc(var(--tx) * 0.28), calc(var(--ty) * 0.28)) rotate(var(--rot)) scaleX(1.3);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scaleX(0.1);
            opacity: 0;
          }
        }
        @keyframes bomberman-smoke {
          0% {
            transform: translate(0, 0) scale(0.55);
            opacity: 0;
          }
          15% {
            opacity: 0.5;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(1.5);
            opacity: 0;
          }
        }
        @keyframes bomberman-chunk {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.4);
            opacity: 0;
          }
        }
        @keyframes bomberman-blast {
          0% {
            opacity: 0;
            transform: scale(0.2);
          }
          25% {
            opacity: 1;
            transform: scale(1.1);
          }
          60% {
            opacity: 0.85;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.35);
          }
        }
      `}</style>
    </div>
  );
}
