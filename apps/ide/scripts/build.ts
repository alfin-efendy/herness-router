// apps/ide/scripts/build.ts — bundles main, preload (Node targets), and the renderer (HTML + Tailwind).
import { $ } from "bun";
import tailwindPlugin from "bun-plugin-tailwind";

// Main and preload use Node/CJS targets — plain bun build CLI is fine.
await $`bun build ./src/main/index.ts --target=node --external electron --format=cjs --outdir ./dist/main`;
await $`bun build ./src/preload/index.ts --target=node --external electron --format=cjs --outdir ./dist/preload`;

// Renderer uses Bun.build() API so we can pass the Tailwind plugin that processes
// `@import "tailwindcss"` in styles.css and outputs compiled CSS (no raw @import shipped).
const result = await Bun.build({
  entrypoints: ["./src/renderer/index.html"],
  outdir: "./dist/renderer",
  plugins: [tailwindPlugin],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("build: dist/{main,preload,renderer} written");
