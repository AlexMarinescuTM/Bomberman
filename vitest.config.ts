import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    // Pure logic files run under plain node (fast, no DOM needed); the hook
    // test renders a real component tree, so it opts into jsdom by name.
    environmentMatchGlobs: [["test/**/*.test.tsx", "jsdom"]],
  },
});
