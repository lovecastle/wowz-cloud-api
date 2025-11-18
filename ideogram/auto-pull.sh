#!/bin/bash

# Auto-pull script for git repository
# This script checks for changes on the remote master branch and pulls them automatically

REPO_DIR="/root/ideogram"
BRANCH="master"
REMOTE="origin"
LOG_FILE="/var/log/git-auto-pull.log"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Navigate to repository directory
cd "$REPO_DIR" || {
    log_message "ERROR: Failed to navigate to $REPO_DIR"
    exit 1
}

# Fetch latest changes from remote
log_message "Fetching changes from $REMOTE/$BRANCH..."
git fetch "$REMOTE" "$BRANCH" 2>&1 | tee -a "$LOG_FILE"

# Check if there are any new commits
LOCAL=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse "$REMOTE/$BRANCH")

if [ "$LOCAL" != "$REMOTE_SHA" ]; then
    log_message "New changes detected. Pulling from $REMOTE/$BRANCH..."

    # Check if there are local uncommitted changes
    if [[ -n $(git status -s) ]]; then
        log_message "WARNING: Local uncommitted changes detected. Stashing them..."
        git stash save "Auto-stash before pull at $(date)" 2>&1 | tee -a "$LOG_FILE"
        STASHED=true
    else
        STASHED=false
    fi

    # Pull the changes
    git pull "$REMOTE" "$BRANCH" 2>&1 | tee -a "$LOG_FILE"

    if [ $? -eq 0 ]; then
        log_message "Successfully pulled changes from $REMOTE/$BRANCH"

        # If we stashed changes, try to reapply them
        if [ "$STASHED" = true ]; then
            log_message "Attempting to reapply stashed changes..."
            git stash pop 2>&1 | tee -a "$LOG_FILE"
            if [ $? -eq 0 ]; then
                log_message "Successfully reapplied stashed changes"
            else
                log_message "WARNING: Failed to reapply stashed changes. Run 'git stash list' to see stashed changes"
            fi
        fi

        # Restart service if needed (uncomment if you want to restart the server)
        # log_message "Restarting application service..."
        # npm restart 2>&1 | tee -a "$LOG_FILE"
    else
        log_message "ERROR: Failed to pull changes"
        exit 1
    fi
else
    log_message "No new changes detected. Repository is up to date."
fi
