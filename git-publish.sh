#!/bin/bash

# Check if a commit message was provided
if [ -z "$1" ]; then
    echo "❌ Error: No commit message provided!"
    echo "Usage: ./git-commit-push.sh \"Your commit message\""
    exit 1
fi

# Assign commit message
COMMIT_MSG="$1"

# Add all changes
git add .

# Commit changes
git commit -m "$COMMIT_MSG"

# Push to the current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push origin "$CURRENT_BRANCH"

# Success message
echo "✅ Changes pushed successfully to '$CURRENT_BRANCH'!"
