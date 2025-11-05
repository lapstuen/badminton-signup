#!/bin/bash

# Badminton App - Automated Deployment Script
# Automatically updates version number and deploys to Firebase

set -e  # Exit on error

echo "🚀 Starting deployment process..."
echo ""

# Get current timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
echo "📅 Version: $TIMESTAMP"

# Update version number in index.html
echo "📝 Updating version number..."
sed -i '' "s/Version: [0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} [0-9]\{2\}:[0-9]\{2\}/Version: $TIMESTAMP/" index.html

# Check if there are changes
if git diff --quiet index.html; then
    echo "ℹ️  No version change needed"
else
    echo "✅ Version updated to: $TIMESTAMP"
fi

# Deploy to Firebase
echo ""
echo "🔥 Deploying to Firebase..."
npx firebase deploy

# Commit version change if any
if ! git diff --quiet index.html; then
    echo ""
    echo "💾 Committing version update..."
    git add index.html
    git commit -m "Update version to $TIMESTAMP

🤖 Auto-deployed with deploy.sh

Co-Authored-By: Claude <noreply@anthropic.com>"
    git push
    echo "✅ Version committed and pushed to GitHub"
fi

echo ""
echo "🎉 Deployment complete!"
echo "🌐 Live at: https://badminton-b95ac.web.app"
echo "📦 Version: $TIMESTAMP"
