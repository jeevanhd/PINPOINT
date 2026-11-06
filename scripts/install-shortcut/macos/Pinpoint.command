#!/bin/bash
# Pinpoint launcher for macOS.
cd "$(dirname "$0")/../.." || exit 1
node scripts/launcher.mjs start
