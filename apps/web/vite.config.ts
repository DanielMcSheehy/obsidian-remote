import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/force-graph") || id.includes("node_modules/d3-") || id.includes("node_modules/@tweenjs") || id.includes("node_modules/kapsule") || id.includes("node_modules/bezier-js")) {
            return "force-graph";
          }
          if (id.includes("node_modules/@mantine")) return "mantine";
          if (id.includes("node_modules/framer-motion")) return "motion";
          if (id.includes("node_modules/@dnd-kit")) return "dnd";
          if (
            id.includes("node_modules/react-markdown") ||
            id.includes("node_modules/mdast") ||
            id.includes("node_modules/unified") ||
            id.includes("node_modules/remark") ||
            id.includes("node_modules/hast") ||
            id.includes("node_modules/unist") ||
            id.includes("node_modules/micromark") ||
            id.includes("node_modules/vfile")
          ) {
            return "markdown";
          }
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) {
            return "react";
          }
          if (id.includes("node_modules/@tabler")) return "icons";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/view": "http://localhost:3000",
      "/couch": "http://localhost:3000",
      "/healthz": "http://localhost:3000",
    },
  },
});
