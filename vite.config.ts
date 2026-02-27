import { defineConfig } from "vite";

export default defineConfig({
  base: "/powder-rush/",
  build: {
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
});
