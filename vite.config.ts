// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins.

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",

        manifest: {
          name: "ElectroSoft",
          short_name: "Linear-Testing",
          description: "Reactor Monitoring Dashboard",

          theme_color: "#0f172a",
          background_color: "#0f172a",

          display: "standalone",
          orientation: "portrait",

          scope: "/",
          start_url: "/",

          icons: [
            {
              src: "/web-app-manifest-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/web-app-manifest-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/web-app-manifest-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },

        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        },

        devOptions: {
          enabled: false,
        },
      }),
    ],

    server: {
      port: 5173,
      strictPort: true,
    },

    // Buffer polyfill — react-pdf's PNG decoder relies on Node's Buffer
    // API, which Vite does not polyfill for the browser by default
    // (unlike Webpack/CRA). Without this, PNG images (logo, etc.) fail
    // with "Incomplete or corrupt PNG file" / "Buffer is not defined"
    // even when the file itself is perfectly valid.
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