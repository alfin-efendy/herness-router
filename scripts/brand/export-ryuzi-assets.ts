import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dir, "..", "..");
const brandDir = join(root, "assets", "brand");

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean) as string[];

const chrome = chromeCandidates.find((candidate) => existsSync(candidate));

if (!chrome) {
  throw new Error("Chrome or Edge is required to export brand PNG/ICO assets. Set CHROME_PATH to the browser executable.");
}

type ExportSpec = {
  source: string;
  output: string;
  width: number;
  height: number;
};

const exports: ExportSpec[] = [
  { source: "wordmark.svg", output: "wordmark.png", width: 1600, height: 420 },
  { source: "wordmark-light.svg", output: "wordmark-light.png", width: 1600, height: 420 },
  { source: "wordmark-dark.svg", output: "wordmark-dark.png", width: 1600, height: 420 },
  { source: "wordmark-adaptive.svg", output: "wordmark-adaptive.png", width: 1600, height: 420 },
  { source: "mark.svg", output: "mark.png", width: 1024, height: 1024 },
  { source: "mark-light.svg", output: "mark-light.png", width: 1024, height: 1024 },
  { source: "mark-dark.svg", output: "mark-dark.png", width: 1024, height: 1024 },
  { source: "mark-adaptive.svg", output: "mark-adaptive.png", width: 1024, height: 1024 },
  { source: "mark-solid.svg", output: "mark-solid.png", width: 1024, height: 1024 },
  { source: "mark-solid.svg", output: "icon-512.png", width: 512, height: 512 },
];

function renderSvgToPng(spec: ExportSpec) {
  const source = join(brandDir, spec.source);
  const output = resolve(brandDir, spec.output);
  const renderTmp = mkdtempSync(join(tmpdir(), "ryuzi-brand-render-"));
  const html = join(renderTmp, "render.html");
  writeFileSync(
    html,
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden}img{display:block;width:100vw;height:100vh;object-fit:contain}</style></head><body><img src="${pathToFileURL(source).href}" alt=""></body></html>`,
  );
  const result = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--default-background-color=00000000",
      `--window-size=${spec.width},${spec.height}`,
      `--screenshot=${output}`,
      pathToFileURL(html).href,
    ],
    { stdio: "inherit" },
  );
  rmSync(renderTmp, { recursive: true, force: true });

  if (result.status !== 0) {
    throw new Error(`Failed to render ${spec.source} to ${spec.output}`);
  }
}

function writeIcoFromPngs(entries: { size: number; png: Buffer }[]) {
  const headerSize = 6;
  const directorySize = 16 * entries.length;
  let imageOffset = headerSize + directorySize;
  const directories: Buffer[] = [];

  for (const entry of entries) {
    const directory = Buffer.alloc(16);
    directory.writeUInt8(entry.size === 256 ? 0 : entry.size, 0);
    directory.writeUInt8(entry.size === 256 ? 0 : entry.size, 1);
    directory.writeUInt8(0, 2);
    directory.writeUInt8(0, 3);
    directory.writeUInt16LE(1, 4);
    directory.writeUInt16LE(32, 6);
    directory.writeUInt32LE(entry.png.length, 8);
    directory.writeUInt32LE(imageOffset, 12);
    directories.push(directory);
    imageOffset += entry.png.length;
  }

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  writeFileSync(join(brandDir, "favicon.ico"), Buffer.concat([header, ...directories, ...entries.map((entry) => entry.png)]));
}

for (const spec of exports) {
  renderSvgToPng(spec);
}

const tmp = mkdtempSync(join(tmpdir(), "ryuzi-brand-"));
try {
  const faviconSizes = [16, 32, 48];
  const entries = faviconSizes.map((size) => {
    const output = join(tmp, `favicon-${size}.png`);
    renderSvgToPng({ source: "mark-solid.svg", output, width: size, height: size });
    return { size, png: readFileSync(output) };
  });
  writeIcoFromPngs(entries);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`Exported ryuzi brand assets with ${chrome}`);
