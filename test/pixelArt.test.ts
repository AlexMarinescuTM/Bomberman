import { describe, expect, it } from "vitest";
import {
  BLAST_ICON_COLORS,
  BLAST_ICON_SPRITE,
  BOMB_COLORS,
  BOMB_SPRITE,
  BOOT_COLORS,
  BOOT_SPRITE,
  ENEMY_COLORS,
  ENEMY_SPRITE,
  HEART_COLORS,
  HEART_SPRITE,
  PICKUP_COLORS,
  PICKUP_SPRITE,
  PLAYER_COLORS,
  PLAYER_SPRITE,
  STAR_COLORS,
  STAR_SPRITE,
} from "../src/pixelArt";

// Every hand-authored sprite must be a well-formed rectangular grid, and every
// glyph it uses must resolve to a real colour -- otherwise it silently renders
// as a transparent hole. This is a cheap, generic safety net for any sprite
// added later, not just the ones listed here.
const SPRITES: [string, readonly string[], Record<string, string>][] = [
  ["PLAYER", PLAYER_SPRITE, PLAYER_COLORS],
  ["ENEMY", ENEMY_SPRITE, ENEMY_COLORS],
  ["BOMB", BOMB_SPRITE, BOMB_COLORS],
  ["PICKUP", PICKUP_SPRITE, PICKUP_COLORS],
  ["STAR", STAR_SPRITE, STAR_COLORS],
  ["BLAST_ICON", BLAST_ICON_SPRITE, BLAST_ICON_COLORS],
  ["BOOT", BOOT_SPRITE, BOOT_COLORS],
  ["HEART", HEART_SPRITE, HEART_COLORS],
];

describe.each(SPRITES)("%s sprite", (_name, rows, palette) => {
  it("is a rectangular grid (every row the same width)", () => {
    const widths = new Set(rows.map((r) => r.length));
    expect(widths.size).toBe(1);
  });

  it("every non-blank glyph has a defined colour", () => {
    const glyphs = new Set(rows.join("").split("").filter((c) => c !== "."));
    for (const g of glyphs) expect(palette[g]).toBeDefined();
  });

  it("is not entirely blank", () => {
    expect(rows.some((r) => [...r].some((c) => c !== "."))).toBe(true);
  });
});

describe("BOOT_SPRITE (kick power-up icon)", () => {
  it("is a 16x16 grid, matching the other power-up icons", () => {
    expect(BOOT_SPRITE).toHaveLength(16);
    expect(BOOT_SPRITE.every((r) => r.length === 16)).toBe(true);
  });
});
