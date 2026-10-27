import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error Node-only ESM plugin; never bundled into client code.
import { beyondBackend } from "./server/vite-plugin.mjs";
export default defineConfig({
  plugins: [react(), beyondBackend()],
  server: {
    watch: { ignored: ["**/.local/**"] },
    fs: {
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/.local/**",
        "**/server/**",
      ],
    },
  },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
