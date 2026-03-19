import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ["tests/**/*.test.ts"],
  },
});
