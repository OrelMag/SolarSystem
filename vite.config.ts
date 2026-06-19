import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        wallpaper: "wallpaper.html",
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
