import { describe, expect, it } from "vitest";
import {
  CRATE_BREAK_VARIANTS,
  crateDebrisSpec,
  crateShards,
  crateVariantFor,
} from "../src/crateBreaks";

describe("crateVariantFor", () => {
  it("defines exactly four distinct variants", () => {
    expect(new Set(CRATE_BREAK_VARIANTS).size).toBe(4);
  });

  it("is deterministic for a given tile", () => {
    expect(crateVariantFor(4, 7)).toBe(crateVariantFor(4, 7));
  });

  it("never gives orthogonally adjacent crates the same variant", () => {
    const seen = new Set<string>();
    let clash = false;
    for (let y = 0; y < 11; y++) {
      for (let x = 0; x < 13; x++) {
        const v = crateVariantFor(x, y);
        seen.add(v);
        if (v === crateVariantFor(x + 1, y) || v === crateVariantFor(x, y + 1)) clash = true;
      }
    }
    expect(clash).toBe(false);
    expect(seen.size).toBe(4); // all four actually appear across a normal board
  });
});

describe("crateShards / crateDebrisSpec", () => {
  it("every variant has its own shard geometry", () => {
    const unique = new Set(CRATE_BREAK_VARIANTS.map((v) => JSON.stringify(crateShards(v))));
    expect(unique.size).toBe(4);
  });

  it("every variant has its own debris feel", () => {
    const unique = new Set(CRATE_BREAK_VARIANTS.map((v) => JSON.stringify(crateDebrisSpec(v))));
    expect(unique.size).toBe(4);
  });

  it("burst throws debris upward, crumble drops it downward", () => {
    expect(crateDebrisSpec("burst").riseBias).toBeLessThan(0);
    expect(crateDebrisSpec("crumble").riseBias).toBeGreaterThan(0);
  });

  it("every variant produces exactly four shards, one per quadrant", () => {
    for (const v of CRATE_BREAK_VARIANTS) {
      const shards = crateShards(v);
      expect(shards).toHaveLength(4);
      const quadrants = new Set(shards.map((s) => `${s.qx},${s.qy}`));
      expect(quadrants).toEqual(new Set(["0,0", "1,0", "0,1", "1,1"]));
    }
  });
});
