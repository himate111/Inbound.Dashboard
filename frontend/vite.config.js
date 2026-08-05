import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envDir: "../",

  server: {
    host: "0.0.0.0",
    port: 5173,

    allowedHosts: [
      "footpath-busboy-swizzle.ngrok-free.dev"
    ],

    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true
      }
    }
  },

  preview: {
    host: "0.0.0.0"
  },

  build: {
    chunkSizeWarningLimit: 1000
  }
});