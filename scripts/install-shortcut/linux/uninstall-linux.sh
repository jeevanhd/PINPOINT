#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
cd "$ROOT" && node scripts/launcher.mjs stop || true
rm -f "$HOME/.local/share/applications/pinpoint.desktop"
rm -f "$DESKTOP_DIR/pinpoint.desktop"
echo "Removed the Pinpoint launcher and stopped the app."
