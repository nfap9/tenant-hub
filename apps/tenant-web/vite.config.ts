import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          )
            return 'vendor-react';
          if (id.includes('/antd/') || id.includes('/@ant-design/'))
            return 'vendor-antd';
          if (
            id.includes('/react-router-dom/') ||
            id.includes('/react-router/')
          )
            return 'vendor-router';
        },
      },
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
  server: {
    port: 8080,
    watch: { usePolling: true, interval: 100 },
  },
});
