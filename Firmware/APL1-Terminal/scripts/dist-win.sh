#!/usr/bin/env bash
# Build Windows NSIS installer (x64) locally on macOS using native Wine.
# Uses bundled NAPI prebuilds from @serialport/bindings-cpp — no cross-compilation needed.
# Requires: Wine (brew install --cask wine-stable)
set -e

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Remove locally compiled macOS binary before packaging.
# node-gyp-build checks build/Release/ *before* prebuilds/, so without this the
# macOS arm64 binary shadows the correct win32-x64 prebuild at runtime on Windows.
rm -rf node_modules/@serialport/bindings-cpp/build

CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win --config.npmRebuild=false
