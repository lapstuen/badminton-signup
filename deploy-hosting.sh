#!/bin/bash

# Badminton App - Quick Hosting Deployment
# Only deploys frontend (faster than full deploy)

set -e  # Exit on error

echo "🚀 Quick deployment (hosting only)..."
echo ""

# Get current timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
echo "📅 Version: $TIMESTAMP"

# Update version number in index.html
echo "📝 Updating version number..."
sed -i '' "s/Version: [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} [0-9]\{2\}:[0-9]\{2\}/Version: $TIMESTAMP/" index.html
echo "✅ Version updated to: $TIMESTAMP"

# Deploy only hosting (faster)
echo ""
echo "🔥 Deploying hosting to Firebase..."
npx firebase deploy --only hosting

# Commit version change
echo ""
echo "💾 Committing version update..."
git add index.html
git commit -m "Update version to $TIMESTAMP

🤖 Auto-deployed with deploy-hosting.sh

Co-Authored-By: Claude <noreply@anthropic.com>"
git push

echo ""
echo "🎉 Deployment complete!"
echo "🌐 Live at: https://badminton-b95ac.web.app"
echo "📦 Version: $TIMESTAMP"
