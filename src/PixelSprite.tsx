import React from "react";

// Draws a pixel-art sprite as crisp SVG rects.
//
// Rows are strings of palette keys; "." (or any key absent from the palette) is
// transparent. Horizontally adjacent same-colour pixels are merged into a single
// rect, so a 16x16 sprite costs a handful of nodes rather than 256.
/**
 * Plays a looping frame animation, sprite-sheet style: the frames sit side by
 * side in a strip and the strip is stepped one frame-width at a time behind a
 * fixed-size window. That runs entirely on the compositor -- no per-frame React
 * state, so an idling character costs no re-renders.
 *
 * Pair with the `px-sprite-strip` keyframe (translateX 0 -> -100%); because the
 * offset is a percentage of the strip's own width, `steps(n)` lands exactly on
 * each frame boundary whatever the frame count.
 */
export function AnimatedPixelSprite({
  frames,
  palette,
  size,
  durationMs,
  paused = false,
  loop = true,
  style,
}: {
  frames: readonly (readonly string[])[];
  palette: Record<string, string>;
  size: number;
  durationMs: number;
  paused?: boolean;
  /** false plays the frames once and holds the last one -- used for the bomb fuse */
  loop?: boolean;
  style?: React.CSSProperties;
}) {
  if (paused || frames.length <= 1) {
    return <PixelSprite rows={frames[0]} palette={palette} size={size} style={style} />;
  }
  return (
    <div style={{ width: size, height: size, overflow: "hidden", ...style }}>
      <div
        style={{
          display: "flex",
          width: size * frames.length,
          height: size,
          animation: `px-sprite-strip ${durationMs}ms steps(${frames.length}) ${
            loop ? "infinite" : "1 forwards"
          }`,
        }}
      >
        {frames.map((rows, i) => (
          <PixelSprite
            key={i}
            rows={rows}
            palette={palette}
            size={size}
            style={{ flexShrink: 0 }}
          />
        ))}
      </div>
    </div>
  );
}

export function PixelSprite({
  rows,
  palette,
  size,
  style,
}: {
  rows: readonly string[];
  palette: Record<string, string>;
  size: number;
  style?: React.CSSProperties;
}) {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const rects: React.ReactElement[] = [];
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    let x = 0;
    while (x < w) {
      const ch = row[x];
      const fill = palette[ch];
      if (!fill) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < w && row[x + run] === ch) run++;
      rects.push(
        <rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={fill} />
      );
      x += run;
    }
  }
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      style={{ display: "block", ...style }}
      aria-hidden
    >
      {rects}
    </svg>
  );
}
