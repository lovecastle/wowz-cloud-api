# Git Auto-Pull Setup

This repository is configured to automatically pull changes from the remote `master` branch every 5 minutes.

## How It Works

- **Script**: `/root/ideogram/auto-pull.sh` - Checks for and pulls new changes
- **Service**: `git-auto-pull.service` - Systemd service that runs the script
- **Timer**: `git-auto-pull.timer` - Runs the service every 5 minutes
- **Log File**: `/var/log/git-auto-pull.log` - Contains all auto-pull activity logs

## Management Commands

### Check Status
```bash
# Check if the timer is running
systemctl status git-auto-pull.timer

# View upcoming scheduled runs
systemctl list-timers git-auto-pull.timer

# Check the service status
systemctl status git-auto-pull.service
```

### Start/Stop Auto-Pull
```bash
# Stop auto-pull
systemctl stop git-auto-pull.timer

# Start auto-pull
systemctl start git-auto-pull.timer

# Restart auto-pull
systemctl restart git-auto-pull.timer

# Disable auto-pull (won't start on boot)
systemctl disable git-auto-pull.timer

# Enable auto-pull (start on boot)
systemctl enable git-auto-pull.timer
```

### Manual Pull
```bash
# Trigger a manual pull check
/root/ideogram/auto-pull.sh

# Or via systemd
systemctl start git-auto-pull.service
```

### View Logs
```bash
# View auto-pull log file
tail -f /var/log/git-auto-pull.log

# View systemd journal logs
journalctl -u git-auto-pull.service -f

# View last 50 log entries
journalctl -u git-auto-pull.service -n 50
```

### Change Pull Interval

Edit the timer configuration:
```bash
nano /etc/systemd/system/git-auto-pull.timer
```

Modify the `OnCalendar` line:
- Every 1 minute: `OnCalendar=*:0/1`
- Every 5 minutes: `OnCalendar=*:0/5`
- Every 10 minutes: `OnCalendar=*:0/10`
- Every 30 minutes: `OnCalendar=*:0/30`
- Every hour: `OnCalendar=hourly`

After editing, reload and restart:
```bash
systemctl daemon-reload
systemctl restart git-auto-pull.timer
```

## How Auto-Pull Handles Local Changes

When new remote changes are detected:

1. **No local changes**: Pulls directly
2. **With uncommitted local changes**:
   - Stashes your changes automatically
   - Pulls the remote changes
   - Attempts to reapply your stashed changes
   - If conflicts occur, your changes remain in the stash

To view and recover stashed changes:
```bash
# List stashed changes
git stash list

# Apply the most recent stash
git stash pop

# Apply a specific stash (e.g., stash@{0})
git stash apply stash@{0}
```

## Customization

### Auto-Restart Application After Pull

To automatically restart your Node.js server after pulling new changes, edit `/root/ideogram/auto-pull.sh` and uncomment these lines:

```bash
# Restart service if needed
log_message "Restarting application service..."
npm restart 2>&1 | tee -a "$LOG_FILE"
```

### Change Repository or Branch

Edit `/root/ideogram/auto-pull.sh` and modify these variables:

```bash
REPO_DIR="/root/ideogram"  # Your repository path
BRANCH="master"            # Your target branch
REMOTE="origin"            # Your remote name
```

## Troubleshooting

### Check if timer is active
```bash
systemctl is-active git-auto-pull.timer
```

### View all timer details
```bash
systemctl show git-auto-pull.timer
```

### Test the script manually
```bash
bash -x /root/ideogram/auto-pull.sh
```

### Check for errors
```bash
journalctl -u git-auto-pull.service --since today
```

## Uninstall Auto-Pull

To remove the auto-pull system:

```bash
# Stop and disable the timer
systemctl stop git-auto-pull.timer
systemctl disable git-auto-pull.timer

# Remove systemd files
rm /etc/systemd/system/git-auto-pull.service
rm /etc/systemd/system/git-auto-pull.timer

# Reload systemd
systemctl daemon-reload

# Optionally remove the script and log
rm /root/ideogram/auto-pull.sh
rm /var/log/git-auto-pull.log
```
