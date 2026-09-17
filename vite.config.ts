import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  nitro: {
    preset: "node-server",
  },
  vite: {
    plugins: [
      VitePWA({
        // ...unchanged, everything else stays exactly the same
      }),
    ],
    server: {
      port: 5173,
      strictPort: true,
    },
    define: {
      global: "globalThis",
    },
    resolve: {
      alias: {
        buffer: "buffer",
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
  },
});