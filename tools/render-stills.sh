#!/usr/bin/env bash
# Render the plugin's real client.js in WSL headless Chromium.
set -euo pipefail
ROOT="/mnt/c/deepseek harness/dsh-boot-plugin"
cd "$ROOT"
export NODE_PATH=/opt/dsh-capture/node_modules
node "$ROOT/tools/render-stills.cjs" "${1:-1200,3000,4200,5200,6200}"
