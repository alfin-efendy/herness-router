// apps/ide/scripts/dev.ts — watch-build the three bundles and launch electron.
import { $ } from "bun";
import tailwindPlugin from "bun-plugin-tailwind";

// Initial build (main + preload via CLI; renderer via Bun.build API with Tailwind plugin).
await $`bun run scripts/build.ts`;

// Watch mode: main + preload use CLI flags; renderer uses Bun.build() with --watch not yet
// supported in the API, so fall back to CLI for watch (plugin not needed for watch, Tailwind
// classes are inlined via the plugin only at bundle time; styles are loaded from the compiled
// output). Rebuild renderer on file change via the CLI watcher with the same entrypoint.
$`bun build ./src/main/index.ts --target=node --external electron --format=cjs --outdir ./dist/main --watch`.nothrow();
$`bun build ./src/preload/index.ts --target=node --external electron --format=cjs --outdir ./dist/preload --watch`.nothrow();
$`bun build ./src/renderer/index.html --outdir ./dist/renderer --watch`.nothrow();

await $`electron dist/main/index.js`;
