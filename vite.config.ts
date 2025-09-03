import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
});
