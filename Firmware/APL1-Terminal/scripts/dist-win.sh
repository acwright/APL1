#!/usr/bin/env bash
# Build Windows NSIS installer (x64) locally on macOS using native Wine.
# Uses bundled NAPI prebuilds from @serialport/bindings-cpp — no cross-compilation needed.
# Requires: Wine (brew install --cask wine-stable)
set -e

cd "$(dirname "${BASH_SOURCE[0]}")/.."
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win --config.npmRebuild=false
