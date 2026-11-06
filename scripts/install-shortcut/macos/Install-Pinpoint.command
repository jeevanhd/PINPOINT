#!/bin/bash
# Installs Pinpoint.app-ish launcher on the Desktop (a .command file, double-clickable).
set -e
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TARGET="$HOME/Desktop/Pinpoint.command"
cat > "$TARGET" <<SCRIPT
#!/bin/bash
cd "$ROOT" || exit 1
node scripts/launcher.mjs start
SCRIPT
chmod +x "$TARGET"
echo "Installed $TARGET"
echo "If macOS blocks it: right-click the file, choose Open, then confirm."
