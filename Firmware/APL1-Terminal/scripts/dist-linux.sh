#!/usr/bin/env bash
# Build Linux targets (AppImage + deb, x64) inside Docker.
# Runs on macOS — Docker Desktop required.
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

docker run --rm \
  -v "${PROJECT_DIR}":/project \
  -v apl1-terminal-linux-modules:/project/node_modules \
  -v "${HOME}/.cache/electron":/root/.cache/electron \
  -v "${HOME}/.cache/electron-builder":/root/.cache/electron-builder \
  electronuserland/builder \
  bash -c "cd /project && npm ci && npm run build && npx electron-builder --linux"
