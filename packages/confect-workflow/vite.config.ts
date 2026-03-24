import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["./src/server.ts", "./src/spec.ts", "./src/index.ts"],
    dts: {
      tsgo: true,
    },
    deps: {
      onlyBundle: false,
    },
    exports: true,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
