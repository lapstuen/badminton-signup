#!/bin/bash

# Navigate to the script's directory
cd "$(dirname "$0")"

echo "🚀 Starting local server for Badminton App..."
echo "📂 Directory: $(pwd)"
echo ""
echo "🌐 Open in browser: http://localhost:8000"
echo ""
echo "⚠️  Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Open browser automatically after 2 seconds
(sleep 2 && open http://localhost:8000) &

# Start Python HTTP server
python3 -m http.server 8000
