#!/usr/bin/env bash
set -euo pipefail

ENTRY="apps/cli/src/cli/index.ts"
OUT="out"
rm -rf "$OUT"

# bun --target              -> output path (GoReleaser {{.Os}}_{{.Arch}} layout)
build() {
  local target="$1" dest="$2"
  mkdir -p "$(dirname "$dest")"
  echo ">> $target -> $dest"
  bun build "$ENTRY" --compile --minify --target="$target" --outfile="$dest"
}

build bun-linux-x64        "$OUT/gnu/linux_amd64/ryuzi"
build bun-linux-arm64      "$OUT/gnu/linux_arm64/ryuzi"
build bun-linux-x64-musl   "$OUT/musl/linux_amd64/ryuzi"
build bun-linux-arm64-musl "$OUT/musl/linux_arm64/ryuzi"
build bun-darwin-x64       "$OUT/other/darwin_amd64/ryuzi"
build bun-darwin-arm64     "$OUT/other/darwin_arm64/ryuzi"
build bun-windows-x64      "$OUT/other/windows_amd64/ryuzi.exe"

chmod +x "$OUT"/gnu/*/ryuzi "$OUT"/musl/*/ryuzi "$OUT"/other/darwin_*/ryuzi
echo "OK: built $(find "$OUT" -type f | wc -l) binaries"
