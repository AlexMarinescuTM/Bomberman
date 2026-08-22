import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Two projects rather than one suite, so the environment is decided by the
// config instead of a per-file `@vitest-environment` docblock that is easy to
// forget. Pure logic (.test.ts) runs under plain node, which is markedly
// faster; anything rendering React (.test.tsx) gets jsdom automatically.
//
// NB: this used to be `environmentMatchGlobs`, which Vitest 4 removed. It was
// silently ignored, so jsdom was really coming from a docblock and the next
// .test.tsx added would have failed with `document is not defined`.
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["test/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          include: ["test/**/*.test.tsx"],
          environment: "jsdom",
        },
      },
    ],
  },
});
