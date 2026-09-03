import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  assetsInclude: ["**/*.lottie", "**/*.pdf"],
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * The function form, not the object form, and deliberately so.
         *
         * The object form pulls each listed module's whole dependency subtree
         * into that chunk, which caused two separate versions of the same bug:
         * "recharts" absorbed React (making 564 kB eager on every route), and
         * once that was fixed it absorbed clsx instead — which cn() means every
         * component needs, so the chunk stayed eager anyway. Rollup also puts
         * its synthetic __vitePreload helper into whichever chunk it likes,
         * which made the pdf chunks static imports of the entry purely to
         * export a one-line function.
         *
         * Matching on exact package directory boundaries keeps each library
         * where it is put, and pins the preload helper somewhere already eager.
         */
        manualChunks(id) {
          // Rollup's own synthetic helper modules — the dynamic-import helper
          // and the CommonJS interop shims. They are a handful of lines each,
          // but Rollup drops them into whichever chunk it feels like, and the
          // entry needs them; that alone is enough to make a 370 kB chunk a
          // static import of the entry. Pin them somewhere already eager.
          if (
            id.includes("vite/preload-helper") ||
            id.includes("commonjsHelpers") ||
            id.includes("commonjs-dynamic-modules")
          ) {
            return "vendor-react";
          }

          if (!id.includes("node_modules")) return undefined;

          const pkg = (name: string) =>
            new RegExp(`[\\\\/]node_modules[\\\\/]${name}[\\\\/]`).test(id);

          // React itself, claimed first so nothing else can absorb it.
          if (pkg("react") || pkg("react-dom") || pkg("scheduler")) return "vendor-react";

          // Shared by practically every component through cn().
          if (pkg("clsx") || pkg("tailwind-merge") || pkg("class-variance-authority")) {
            return "vendor-ui";
          }

          if (pkg("recharts") || pkg("d3-.*") || pkg("victory-vendor")) return "vendor-recharts";
          if (pkg("framer-motion") || pkg("motion-dom") || pkg("motion-utils")) return "vendor-motion";
          if (pkg("react-pdf") || pkg("pdfjs-dist")) return "vendor-pdfjs";
          if (pkg("jspdf") || pkg("html-to-image") || pkg("html2canvas") || pkg("canvg")) {
            return "vendor-pdf";
          }

          return undefined;
        },
      },
    },
  },
}));
