#!/usr/bin/env bash
set -euo pipefail
# Copies built binaries (./out) into the npm platform package dirs.
# Assumes scripts/build-binaries.sh already ran.

cp out/gnu/linux_amd64/ryuzi         npm/platform/ryuzi-linux-x64/ryuzi
cp out/gnu/linux_arm64/ryuzi         npm/platform/ryuzi-linux-arm64/ryuzi
cp out/musl/linux_amd64/ryuzi        npm/platform/ryuzi-linux-x64-musl/ryuzi
cp out/musl/linux_arm64/ryuzi        npm/platform/ryuzi-linux-arm64-musl/ryuzi
cp out/other/darwin_amd64/ryuzi      npm/platform/ryuzi-darwin-x64/ryuzi
cp out/other/darwin_arm64/ryuzi      npm/platform/ryuzi-darwin-arm64/ryuzi
cp out/other/windows_amd64/ryuzi.exe npm/platform/ryuzi-win32-x64/ryuzi.exe

chmod +x npm/platform/ryuzi-linux-x64/ryuzi \
         npm/platform/ryuzi-linux-arm64/ryuzi \
         npm/platform/ryuzi-linux-x64-musl/ryuzi \
         npm/platform/ryuzi-linux-arm64-musl/ryuzi \
         npm/platform/ryuzi-darwin-x64/ryuzi \
         npm/platform/ryuzi-darwin-arm64/ryuzi
echo "OK: assembled npm packages"
