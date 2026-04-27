#!/usr/bin/env bash
set -euo pipefail

# Resolve the project root (two levels up from this script)
PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="$PROJECT_DIR/scripts/pigi/log"
PLIST_TEMPLATE="$PROJECT_DIR/scripts/pigi/com.eureka.pigi.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.eureka.pigi.plist"

echo "📁  Project:  $PROJECT_DIR"
echo "📋  Plist:    $PLIST_DST"
echo ""

# Ensure log directory exists (launchd needs it for stdout/stderr redirection)
mkdir -p "$LOG_DIR"

# Substitute __PROJECT_DIR__ placeholder with the resolved absolute path
sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$PLIST_TEMPLATE" > "$PLIST_DST"

# Unload any previously installed version before reloading (idempotent)
launchctl unload "$PLIST_DST" 2>/dev/null || true

launchctl load "$PLIST_DST"

echo "✅  Pigi will now run daily at 6 AM."
echo ""
echo "To stop:    launchctl unload ~/Library/LaunchAgents/com.eureka.pigi.plist"
echo "To restart: launchctl unload ~/Library/LaunchAgents/com.eureka.pigi.plist && launchctl load ~/Library/LaunchAgents/com.eureka.pigi.plist"
