import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "vendor-react";
          if (id.includes("/antd/") || id.includes("/@ant-design/")) return "vendor-antd";
          if (id.includes("/react-router-dom/") || id.includes("/react-router/")) return "vendor-router";
        },
      },
    },
  },
  server: {
    port: 5174,
    watch: { usePolling: true, interval: 100 },
  },
});
