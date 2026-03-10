import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  base: "/webapp/",
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    assetsDir: "assets",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.vite.html")
      },
      output: {
        manualChunks(id) {
          const normalized = String(id || "").replace(/\\/g, "/");
          if (normalized.includes("/node_modules/@babylonjs/")) {
            return "babylon";
          }
          if (
            normalized.includes("/node_modules/react/") ||
            normalized.includes("/node_modules/react-dom/") ||
            normalized.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (
            normalized.includes("/node_modules/@reduxjs/") ||
            normalized.includes("/node_modules/react-redux/") ||
            normalized.includes("/node_modules/use-sync-external-store/") ||
            normalized.includes("/node_modules/zustand/") ||
            normalized.includes("/node_modules/zod/")
          ) {
            return "state-vendor";
          }
          if (
            normalized.includes("/node_modules/three/") ||
            normalized.includes("/node_modules/postprocessing/")
          ) {
            return "scene-vendor";
          }
          if (
            normalized.includes("/node_modules/gsap/") ||
            normalized.includes("/node_modules/howler/")
          ) {
            return "fx-vendor";
          }
          if (normalized.includes("/node_modules/")) {
            return "vendor";
          }
        }
      }
    }
  }
});
