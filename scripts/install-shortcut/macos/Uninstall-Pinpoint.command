#!/bin/bash
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT" || exit 1
node scripts/launcher.mjs stop
rm -f "$HOME/Desktop/Pinpoint.command"
echo "Removed the Pinpoint launcher and stopped the app."
