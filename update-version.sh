#!/bin/bash

# Update version script for badminton app
# Usage: ./update-version.sh "v2025-11-22 12:00" "Description of changes"

if [ -z "$1" ]; then
    echo "❌ Error: Version number required"
    echo "Usage: ./update-version.sh \"v2025-11-22 12:00\" \"Description of changes\""
    exit 1
fi

if [ -z "$2" ]; then
    echo "❌ Error: Description required"
    echo "Usage: ./update-version.sh \"v2025-11-22 12:00\" \"Description of changes\""
    exit 1
fi

VERSION="$1"
DESCRIPTION="$2"

# Extract cache-busting format
# v2025-11-22 12:00 -> 20251122-1200
# Remove 'v', remove dashes from date, replace space with dash, remove colon
CACHE_VERSION=$(echo "$VERSION" | sed 's/v//' | sed 's/-//g' | sed 's/ /-/' | sed 's/://')

echo "📝 Updating version to: $VERSION"
echo "🔧 Cache-busting version: $CACHE_VERSION"
echo "📄 Description: $DESCRIPTION"
echo ""

# Backup index.html
cp index.html "index-backup-$(date +%Y%m%d-%H%M%S).html"
echo "✅ Backup created"

# Update header version
sed -i '' "s/<p class=\"version-header\">v[^<]*<\/p>/<p class=\"version-header\">$VERSION ($DESCRIPTION)<\/p>/" index.html
echo "✅ Updated header version"

# Update footer version
sed -i '' "s/<p class=\"version\">v[^<]*<\/p>/<p class=\"version\">$VERSION ($DESCRIPTION)<\/p>/" index.html
echo "✅ Updated footer version"

# Update cache-busting in script tags
sed -i '' "s/firebase-config.js?v=[0-9-]*/firebase-config.js?v=$CACHE_VERSION/" index.html
sed -i '' "s/app.js?v=[0-9-]*/app.js?v=$CACHE_VERSION/" index.html
echo "✅ Updated cache-busting versions"

echo ""
echo "🎉 All versions updated successfully!"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff index.html"
echo "2. Commit: git add index.html app.js firebase-config.js"
echo "3. Push: git commit -m \"Update version to $VERSION\" && git push"
