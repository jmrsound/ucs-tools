import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const webRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(webRoot, "standalone"),
  base: "/ucs-tagger/",
  publicDir: resolve(webRoot, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(webRoot, "standalone-dist"),
    emptyOutDir: true,
  },
});
