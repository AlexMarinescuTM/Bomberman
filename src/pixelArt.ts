import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// 16-bit (SNES/Genesis era) art kit: a limited palette, hand-authored pixel
// sprites, and the tile styling that goes with them. Everything here is
// deliberately hard-edged -- no blur, no smooth gradients, no antialiasing.
// The sprite renderer itself lives in PixelSprite.tsx.
// ---------------------------------------------------------------------------

export const PIXEL_FONT = "'Press Start 2P', 'Courier New', monospace";

export const PAL = {
  ink: "#0b0b14",
  void: "#0a0a12",
  panel: "#1b1b30",
  panelHi: "#3a3a63",
  panelLo: "#101021",

  floorA: "#2e2e4a",
  floorB: "#282840",
  floorInk: "#21213a",

  wallHi: "#8390bf",
  wallMid: "#525f92",
  wallLo: "#2f3760",
  wallInk: "#171c34",

  brickHi: "#e9974a",
  brickMid: "#bd6229",
  brickLo: "#833d18",
  brickInk: "#43200d",

  ui: "#e9e6d6",
  uiDim: "#8785a6",
  gold: "#ffd23d",
  green: "#67e07a",
  red: "#e8455a",
  cyan: "#5ad2ff",

  fire0: "#fff6d6",
  fire1: "#ffd93d",
  fire2: "#ff9226",
  fire3: "#e8451f",
  smoke: "#6a6a80",
} as const;

// --- sprites ---------------------------------------------------------------

export const PLAYER_SPRITE = [
  "................",
  ".....KKKKKK.....",
  "....KhhhhhhK....",
  "...KhwwwwwwhK...",
  "...KwKwwwwKwK...",
  "...KwwwwwwwwK...",
  "...KhwwwwwwhK...",
  "....KKKKKKKK....",
  "...KbbbBBbbbK...",
  "..KbbbBBBBbbbK..",
  "..KbbBBBBBBbbK..",
  "..KbbbBBBBbbbK..",
  "...KbbbbbbbbK...",
  "...KbbbbbbbbK...",
  "....KK....KK....",
  "................",
] as const;

export const PLAYER_COLORS: Record<string, string> = {
  K: PAL.ink,
  h: "#1f5f96",
  w: "#f2f7ff",
  b: "#2f8fd6",
  B: "#7fd4ff",
};

/** Breathing in: head sits a pixel higher and the torso stretches to match. */
const PLAYER_INHALE = [
  ".....KKKKKK.....",
  "....KhhhhhhK....",
  "...KhwwwwwwhK...",
  "...KwKwwwwKwK...",
  "...KwwwwwwwwK...",
  "...KhwwwwwwhK...",
  "....KKKKKKKK....",
  "...KbbbBBbbbK...",
  "..KbbbBBBBbbbK..",
  "..KbbBBBBBBbbK..",
  "..KbbBBBBBBbbK..",
  "..KbbbBBBBbbbK..",
  "...KbbbbbbbbK...",
  "...KbbbbbbbbK...",
  "....KK....KK....",
  "................",
] as const;

/** Blink: the pupils widen into closed lids. */
const PLAYER_BLINK = [
  "................",
  ".....KKKKKK.....",
  "....KhhhhhhK....",
  "...KhwwwwwwhK...",
  "...KwKKwwKKwK...",
  "...KwwwwwwwwK...",
  "...KhwwwwwwhK...",
  "....KKKKKKKK....",
  "...KbbbBBbbbK...",
  "..KbbbBBBBbbbK..",
  "..KbbBBBBBBbbK..",
  "..KbbbBBBBbbbK..",
  "...KbbbbbbbbK...",
  "...KbbbbbbbbK...",
  "....KK....KK....",
  "................",
] as const;

/** Idle loop: settle, breathe in, settle, blink. */
export const PLAYER_IDLE_FRAMES = [
  PLAYER_SPRITE,
  PLAYER_INHALE,
  PLAYER_SPRITE,
  PLAYER_BLINK,
] as const;
export const PLAYER_IDLE_MS = 1000;

export const ENEMY_SPRITE = [
  "................",
  "................",
  "......KKKK......",
  "....KKrrrrKK....",
  "...KrrrrrrrrK...",
  "..KrrrrrrrrrrK..",
  "..KrKwwrrwwKrK..",
  "..KrKwKrrKwKrK..",
  "..KrrrrrrrrrrK..",
  "..KrrdddddrrrK..",
  "..KrrrrrrrrrrK..",
  "..KRrrrrrrrrRK..",
  "..KrrrrrrrrrrK..",
  "...KrrrrrrrrK...",
  "....KK....KK....",
  "................",
] as const;

/** Squash: the blob settles, flattening and bulging out at the waist. */
const ENEMY_SQUASH = [
  "................",
  "................",
  "................",
  "......KKKK......",
  "....KKrrrrKK....",
  "...KrrrrrrrrK...",
  "..KrKwwrrwwKrK..",
  "..KrKwKrrKwKrK..",
  "..KrrrrrrrrrrK..",
  ".KrrdddddddrrrK.",
  ".KrrrrrrrrrrrrK.",
  ".KRrrrrrrrrrrRK.",
  "..KrrrrrrrrrrK..",
  "...KrrrrrrrrK...",
  "....KK....KK....",
  "................",
] as const;

/** Stretch: it bounces up, drawing in at the sides. */
const ENEMY_STRETCH = [
  "................",
  "......KKKK......",
  "....KKrrrrKK....",
  "...KrrrrrrrrK...",
  "..KrrrrrrrrrrK..",
  "..KrKwwrrwwKrK..",
  "..KrKwKrrKwKrK..",
  "..KrrrrrrrrrrK..",
  "...KrdddddrrK...",
  "...KrrrrrrrrK...",
  "...KRrrrrrrRK...",
  "...KrrrrrrrrK...",
  "...KrrrrrrrrK...",
  "....KrrrrrrK....",
  "....KK....KK....",
  "................",
] as const;

/** Idle loop: rest, squash, rest, stretch -- a slow blobby bounce. */
export const ENEMY_IDLE_FRAMES = [
  ENEMY_SPRITE,
  ENEMY_SQUASH,
  ENEMY_SPRITE,
  ENEMY_STRETCH,
] as const;
export const ENEMY_IDLE_MS = 640;

export const ENEMY_COLORS: Record<string, string> = {
  K: PAL.ink,
  r: "#d63a4a",
  R: "#ff7a86",
  d: "#8b1f2e",
  w: "#ffffff",
};

// The fuse burning down. Only the three fuse rows change between frames -- the
// bomb body is identical throughout, so the casing sits perfectly still while
// the spark eats its way toward the cap.
const BOMB_BODY = [
  ".......cc.......",
  "......cccc......",
  ".....KKKKKK.....",
  "....KKhhddKK....",
  "...KhhddddddK...",
  "...KhdddddddK...",
  "...KhdddddddK...",
  "...KddddddddK...",
  "...KddddddddK...",
  "...KddddddddK...",
  "....KKddddKK....",
  ".....KKKKKK.....",
  "................",
] as const;

const bombFrame = (fuse: readonly string[]) => [...fuse, ...BOMB_BODY] as const;

/** Freshly lit: full cord, flame burning at the far tip. */
export const BOMB_SPRITE = bombFrame([
  ".........sSs....",
  "........ff......",
  ".......f........",
]);

export const BOMB_FUSE_FRAMES = [
  BOMB_SPRITE,
  bombFrame([
    "................",
    "........sSs.....",
    ".......f........",
  ]),
  bombFrame([
    "................",
    "................",
    ".......sSs......",
  ]),
  // flame has burned down to the cap and flares -- about to go off
  bombFrame([
    "................",
    "................",
    "......sSSs......",
  ]),
] as const;

export const BOMB_COLORS: Record<string, string> = {
  K: PAL.ink,
  d: "#2b2b3d",
  h: "#6d6d8c",
  c: "#d0a33c",
  f: "#7a5a30", // unlit cord, kept dark so the flame reads against it
  s: PAL.fire2, // flame edge
  S: PAL.fire0, // white-hot core
};

export const PICKUP_SPRITE = [
  "................",
  "..gggggggggggg..",
  ".gGGGGGGGGGGGGg.",
  ".gG.......s..Gg.",
  ".gG.....cc...Gg.",
  ".gG...KKKK...Gg.",
  ".gG..KddddK..Gg.",
  ".gG.KhdddddK.Gg.",
  ".gG.KhdddddK.Gg.",
  ".gG.KddddddK.Gg.",
  ".gG..KddddK..Gg.",
  ".gG...KKKK...Gg.",
  ".gGGGGGGGGGGGGg.",
  "..gggggggggggg..",
  "................",
  "................",
] as const;

export const PICKUP_COLORS: Record<string, string> = {
  g: "#1f6b34",
  G: PAL.green,
  K: PAL.ink,
  d: "#2b2b3d",
  h: "#6d6d8c",
};

/** Invincibility: a five-point star. */
export const STAR_SPRITE = [
  "................",
  ".......KK.......",
  "......KssK......",
  "......KssK......",
  ".....KssssK.....",
  "KKKKKssssssKKKKK",
  "KssssssssssssssK",
  ".KssssssssssssK.",
  "..KssssssssssK..",
  "...KssssssssK...",
  "...KsssKKsssK...",
  "..KsssK..KsssK..",
  ".KsssK....KsssK.",
  ".KssK......KssK.",
  ".KKK........KKK.",
  "................",
] as const;

export const STAR_COLORS: Record<string, string> = {
  K: PAL.ink,
  s: PAL.gold,
};

/** Pierce: the cross a blast carves out, with the arms flared so it reads as a burst. */
export const BLAST_ICON_SPRITE = [
  "................",
  "................",
  ".....KKKKKK.....",
  ".....KffffK.....",
  "......KffK......",
  "..KKKKKffKKKKK..",
  "..KffffffffffK..",
  ".KffffffffffffK.",
  "..KffffffffffK..",
  "..KKKKKffKKKKK..",
  "......KffK......",
  ".....KffffK.....",
  ".....KKKKKK.....",
  "................",
  "................",
  "................",
] as const;

export const BLAST_ICON_COLORS: Record<string, string> = {
  K: PAL.ink,
  f: PAL.fire2,
};

/** Bomb kick: a boot swinging right, with speed lines trailing off its heel. */
export const BOOT_SPRITE = [
  "................",
  "...KKKKKKK......",
  "...KCCCCCK......",
  "...KCCCCCK......",
  "...KhbbbbK......",
  "ss.KhbbbbK......",
  "...KhbbbbK......",
  "...KhbbbbKK.....",
  "ss.KhbbbbbbK....",
  "...KhbbbbbbbbK..",
  "...KhbbbbbbbbbbK",
  "...KBBBBBBBBBBBK",
  "...KKK..KKKKKKKK",
  "................",
  "................",
  "................",
] as const;

export const BOOT_COLORS: Record<string, string> = {
  K: PAL.ink,
  b: PAL.cyan,
  C: "#9be6ff", // cuff band round the top
  h: "#c9f1ff", // highlight down the front of the shaft
  B: "#2b7fae", // sole, in shadow
  s: PAL.gold, // speed lines trailing off the heel
};

export const HEART_SPRITE = [
  ".RR..RR.",
  "RhRRRRRR",
  "RRRRRRRR",
  "RRRRRRRR",
  ".RRRRRR.",
  "..RRRR..",
  "...RR...",
  "........",
] as const;

export const HEART_COLORS: Record<string, string> = { R: PAL.red, h: "#ff9aa8" };
export const HEART_COLORS_DIM: Record<string, string> = { R: "#39293a", h: "#443349" };

// --- tile styling ----------------------------------------------------------
// Classic 16-bit tiles are flat fills with a hard 1px ink outline and a chunky
// bevel: light on the top/left, shadow on the bottom/right. Zero blur radius
// keeps every edge on the pixel grid.

export function wallTileStyle(): CSSProperties {
  return {
    background: PAL.wallMid,
    boxShadow: [
      `inset 0 0 0 1px ${PAL.wallInk}`,
      `inset 4px 4px 0 ${PAL.wallHi}`,
      `inset -4px -4px 0 ${PAL.wallLo}`,
    ].join(", "),
  };
}

export function brickTileStyle(): CSSProperties {
  return {
    background: PAL.brickMid,
    backgroundImage: [
      `repeating-linear-gradient(0deg, transparent 0 9px, ${PAL.brickInk} 9px 11px)`,
      `repeating-linear-gradient(90deg, transparent 0 18px, ${PAL.brickInk} 18px 20px)`,
    ].join(", "),
    boxShadow: [
      `inset 0 0 0 1px ${PAL.brickInk}`,
      `inset 3px 3px 0 ${PAL.brickHi}`,
      `inset -3px -3px 0 ${PAL.brickLo}`,
    ].join(", "),
  };
}

export function floorTileStyle(x: number, y: number): CSSProperties {
  return {
    background: (x + y) % 2 === 0 ? PAL.floorA : PAL.floorB,
    boxShadow: `inset 0 0 0 1px ${PAL.floorInk}`,
  };
}
