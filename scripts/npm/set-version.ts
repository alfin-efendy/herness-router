// Usage: bun scripts/npm/set-version.ts <version>
// Stamps the version on the main + all platform package.json files and
// pins the main package's optionalDependencies to <version>.
const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`bad version: ${version ?? "(none)"}`);
  process.exit(1);
}

const platformNames = [
  "harness-router-linux-x64",
  "harness-router-linux-arm64",
  "harness-router-linux-x64-musl",
  "harness-router-linux-arm64-musl",
  "harness-router-darwin-x64",
  "harness-router-darwin-arm64",
  "harness-router-win32-x64",
];

for (const name of platformNames) {
  const path = `npm/platform/${name}/package.json`;
  const pkg = await Bun.file(path).json();
  pkg.version = version;
  await Bun.write(path, JSON.stringify(pkg, null, 2) + "\n");
}

const mainPath = "npm/harness-router/package.json";
const main = await Bun.file(mainPath).json();
main.version = version;
main.optionalDependencies = Object.fromEntries(platformNames.map((n) => [n, version]));
await Bun.write(mainPath, JSON.stringify(main, null, 2) + "\n");

console.log(`set version ${version} on ${platformNames.length + 1} packages`);
