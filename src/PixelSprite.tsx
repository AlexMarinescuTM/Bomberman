import React from "react";

// Draws a pixel-art sprite as crisp SVG rects.
//
// Rows are strings of palette keys; "." (or any key absent from the palette) is
// transparent. Horizontally adjacent same-colour pixels are merged into a single
// rect, so a 16x16 sprite costs a handful of nodes rather than 256.
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
