#!/usr/bin/env bash
# Installs a Pinpoint entry in the applications menu and on the Desktop.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
APPS="$HOME/.local/share/applications"
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
mkdir -p "$APPS"

sed "s|__ROOT__|$ROOT|g" "$ROOT/scripts/install-shortcut/linux/pinpoint.desktop" > "$APPS/pinpoint.desktop"
chmod +x "$APPS/pinpoint.desktop"
update-desktop-database "$APPS" 2>/dev/null || true

if [ -d "$DESKTOP_DIR" ]; then
  cp "$APPS/pinpoint.desktop" "$DESKTOP_DIR/pinpoint.desktop"
  chmod +x "$DESKTOP_DIR/pinpoint.desktop"
  gio set "$DESKTOP_DIR/pinpoint.desktop" metadata::trusted true 2>/dev/null || true
fi

echo "Installed Pinpoint launcher in $APPS"
