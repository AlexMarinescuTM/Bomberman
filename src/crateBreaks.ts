// ---------------------------------------------------------------------------
// Crate destruction: four distinct break-up styles. A crate splits into four
// quadrant shards that fly apart according to its variant, backed by matching
// debris/dust particles.
// ---------------------------------------------------------------------------

/** How long the shards of a breaking crate stay on screen. */
export const CRATE_BREAK_MS = 520;

export type CrateBreakVariant = "shatter" | "crumble" | "burst" | "splinter";

export const CRATE_BREAK_VARIANTS: readonly CrateBreakVariant[] = [
  "shatter",
  "crumble",
  "burst",
  "splinter",
];

export type CrateBreak = {
  x: number;
  y: number;
  id: number;
  variant: CrateBreakVariant;
  /** matches the blast ripple delay for this tile so the crate breaks as the flame reaches it */
  delay: number;
};

/**
 * Picks how a crate falls apart, purely from its tile coordinates -- so a given
 * crate always breaks the same way. The `x + 2y` weighting guarantees that any
 * two orthogonally adjacent crates land on different variants, which is what
 * makes the variety actually read on screen.
 */
export function crateVariantFor(x: number, y: number): CrateBreakVariant {
  const n = CRATE_BREAK_VARIANTS.length;
  const i = (((x + 2 * y) % n) + n) % n;
  return CRATE_BREAK_VARIANTS[i];
}

/** One flying quarter of the crate. qx/qy select which quadrant of the tile it starts as. */
export type CrateShard = {
  qx: 0 | 1;
  qy: 0 | 1;
  /** travel offset in px */
  sx: number;
  sy: number;
  /** spin in degrees */
  sr: number;
};

const SHARDS: Record<CrateBreakVariant, CrateShard[]> = {
  // blown apart diagonally, spinning hard
  shatter: [
    { qx: 0, qy: 0, sx: -24, sy: -20, sr: -200 },
    { qx: 1, qy: 0, sx: 24, sy: -20, sr: 200 },
    { qx: 0, qy: 1, sx: -21, sy: 18, sr: -150 },
    { qx: 1, qy: 1, sx: 21, sy: 18, sr: 150 },
  ],
  // sags and collapses straight down into a pile
  crumble: [
    { qx: 0, qy: 0, sx: -5, sy: 15, sr: -20 },
    { qx: 1, qy: 0, sx: 5, sy: 16, sr: 20 },
    { qx: 0, qy: 1, sx: -7, sy: 10, sr: -9 },
    { qx: 1, qy: 1, sx: 7, sy: 11, sr: 9 },
  ],
  // pops upward off the ground
  burst: [
    { qx: 0, qy: 0, sx: -17, sy: -33, sr: -95 },
    { qx: 1, qy: 0, sx: 17, sy: -35, sr: 95 },
    { qx: 0, qy: 1, sx: -13, sy: -19, sr: -60 },
    { qx: 1, qy: 1, sx: 13, sy: -21, sr: 60 },
  ],
  // splits sideways into long slats
  splinter: [
    { qx: 0, qy: 0, sx: -36, sy: -5, sr: -28 },
    { qx: 1, qy: 0, sx: 36, sy: -5, sr: 28 },
    { qx: 0, qy: 1, sx: -31, sy: 7, sr: -16 },
    { qx: 1, qy: 1, sx: 31, sy: 7, sr: 16 },
  ],
};

export function crateShards(variant: CrateBreakVariant): CrateShard[] {
  return SHARDS[variant];
}

/** Debris tuning per variant -- drives the particle burst that accompanies the shards. */
export type CrateDebrisSpec = {
  chunkCount: number;
  distMin: number;
  distMax: number;
  sizeMin: number;
  sizeMax: number;
  /** vertical bias applied to debris: negative throws it up, positive drops it */
  riseBias: number;
  spin: number;
  dustCount: number;
  dustRise: number;
};

const DEBRIS: Record<CrateBreakVariant, CrateDebrisSpec> = {
  shatter: {
    chunkCount: 13, distMin: 22, distMax: 54,
    sizeMin: 3, sizeMax: 6, riseBias: -3, spin: 720,
    dustCount: 3, dustRise: 14,
  },
  crumble: {
    chunkCount: 7, distMin: 5, distMax: 18,
    sizeMin: 5, sizeMax: 10, riseBias: 15, spin: 160,
    dustCount: 10, dustRise: 28,
  },
  burst: {
    chunkCount: 10, distMin: 18, distMax: 42,
    sizeMin: 4, sizeMax: 8, riseBias: -20, spin: 430,
    dustCount: 6, dustRise: 22,
  },
  splinter: {
    chunkCount: 9, distMin: 26, distMax: 48,
    sizeMin: 3, sizeMax: 9, riseBias: 2, spin: 250,
    dustCount: 4, dustRise: 16,
  },
};

export function crateDebrisSpec(variant: CrateBreakVariant): CrateDebrisSpec {
  return DEBRIS[variant];
}
