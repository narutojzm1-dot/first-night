import { renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** GitHub project pages serves this repo at /first-night/. */
function hoistIndex(): Plugin {
  return {
    name: "hoist-pages-index",
    apply: "build",
    closeBundle() {
      const out = resolve("gh-pages");
      renameSync(resolve(out, "pages-site/index.html"), resolve(out, "index.html"));
      rmSync(resolve(out, "pages-site"), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  base: "/first-night/",
  plugins: [tailwindcss(), react(), hoistIndex()],
  resolve: { tsconfigPaths: true },
  build: {
    outDir: "gh-pages",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve("pages-site/index.html"),
    },
  },
});
