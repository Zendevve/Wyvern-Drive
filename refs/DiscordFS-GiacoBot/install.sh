#!/usr/bin/env bash
set -euo pipefail

# ── DiscordFS Installer ──────────────────────────────────────────
# Creates a virtual environment, configures the service, and
# installs a systemd user unit for automatic mounting at login.
# ─────────────────────────────────────────────────────────────────

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$HOME/.config/discordfs"
DATA_DIR="$HOME/.local/share/discordfs"
CACHE_DIR="$HOME/.cache/discordfs"
SERVICE_DIR="$HOME/.config/systemd/user"
ENV_FILE="$CONFIG_DIR/.env"
VENV_DIR="$DATA_DIR/.venv"

# ── Colors ────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Prerequisite checks ──────────────────────────────────────────

check_prerequisites() {
    local missing=0

    # Python >= 3.11
    if command -v python3 &>/dev/null; then
        local py_version
        py_version="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
        local py_major py_minor
        py_major="$(echo "$py_version" | cut -d. -f1)"
        py_minor="$(echo "$py_version" | cut -d. -f2)"
        if (( py_major < 3 || (py_major == 3 && py_minor < 11) )); then
            error "Python >= 3.11 required, found $py_version"
            missing=1
        else
            ok "Python $py_version"
        fi
    else
        error "python3 not found"
        missing=1
    fi

    # python3-venv module
    if ! python3 -c "import venv" &>/dev/null; then
        error "python3-venv not installed (sudo apt install python3-venv or equivalent)"
        missing=1
    fi

    # FUSE
    if command -v fusermount3 &>/dev/null; then
        ok "FUSE 3 (fusermount3)"
    elif command -v fusermount &>/dev/null; then
        ok "FUSE (fusermount)"
    else
        error "fusermount not found — install fuse3 (sudo apt install fuse3 or equivalent)"
        missing=1
    fi

    # systemctl (user services)
    if command -v systemctl &>/dev/null; then
        ok "systemd"
    else
        error "systemctl not found — systemd is required for automatic mounting"
        missing=1
    fi

    if (( missing )); then
        echo ""
        error "Missing prerequisites. Install them and re-run this script."
        exit 1
    fi
}

# ── Configuration ─────────────────────────────────────────────────

configure() {
    if [[ -f "$ENV_FILE" ]]; then
        warn "Configuration already exists at $ENV_FILE"
        read -rp "Overwrite? [y/N] " overwrite
        if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
            info "Keeping existing configuration"
            return
        fi
    fi

    echo ""
    info "Discord bot setup — see README.md for how to create a bot"
    echo ""

    read -rp "Discord bot token: " bot_token
    if [[ -z "$bot_token" ]]; then
        error "Bot token is required"
        exit 1
    fi

    read -rp "Discord channel ID: " channel_id
    if [[ -z "$channel_id" ]]; then
        error "Channel ID is required"
        exit 1
    fi

    read -rsp "Encryption password: " password
    echo ""
    if [[ -z "$password" ]]; then
        error "Password is required"
        exit 1
    fi

    read -rsp "Confirm password: " password_confirm
    echo ""
    if [[ "$password" != "$password_confirm" ]]; then
        error "Passwords do not match"
        exit 1
    fi

    local default_mount="$HOME/DiscordFS"
    read -rp "Mount point [$default_mount]: " mount_point
    mount_point="${mount_point:-$default_mount}"

    # Write .env
    mkdir -p "$CONFIG_DIR"
    cat > "$ENV_FILE" <<ENVEOF
DISCORD_BOT_TOKEN=$bot_token
DISCORD_CHANNEL_ID=$channel_id
DISCORDFS_PASSWORD=$password
MOUNT_POINT=$mount_point
DB_PATH=$CONFIG_DIR/discordfs.db
CACHE_DIR=$CACHE_DIR
CACHE_MAX_MB=500
SYNC_INTERVAL=30
SYNC_ENABLED=true
ENVEOF
    chmod 600 "$ENV_FILE"
    ok "Configuration saved to $ENV_FILE (permissions: 600)"
}

# ── Virtual environment ───────────────────────────────────────────

install_venv() {
    info "Creating virtual environment in $VENV_DIR"
    mkdir -p "$DATA_DIR"

    if [[ -d "$VENV_DIR" ]]; then
        warn "Virtual environment already exists, reinstalling..."
        rm -rf "$VENV_DIR"
    fi

    python3 -m venv "$VENV_DIR"
    "$VENV_DIR/bin/pip" install --upgrade pip --quiet
    "$VENV_DIR/bin/pip" install "$REPO_DIR" --quiet
    ok "Installed DiscordFS in $VENV_DIR"
}

# ── systemd service ──────────────────────────────────────────────

install_service() {
    # Read mount point from .env
    local mount_point
    mount_point="$(grep '^MOUNT_POINT=' "$ENV_FILE" | cut -d= -f2-)"
    mount_point="${mount_point:-$HOME/DiscordFS}"

    # Detect fusermount path
    local fusermount_path
    if command -v fusermount3 &>/dev/null; then
        fusermount_path="$(command -v fusermount3)"
    else
        fusermount_path="$(command -v fusermount)"
    fi

    mkdir -p "$SERVICE_DIR"
    cat > "$SERVICE_DIR/discordfs.service" <<SVCEOF
[Unit]
Description=DiscordFS - Cloud storage backed by Discord
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_DIR/bin/discordfs mount --mount $mount_point --foreground
ExecStop=$fusermount_path -u $mount_point
Restart=on-failure
RestartSec=10

# Security hardening
UMask=0077

[Install]
WantedBy=default.target
SVCEOF

    systemctl --user daemon-reload
    systemctl --user enable discordfs.service
    ok "systemd service installed and enabled"
}

# ── Create directories ────────────────────────────────────────────

create_dirs() {
    # Cache directory with restricted permissions
    mkdir -p "$CACHE_DIR"
    chmod 700 "$CACHE_DIR"

    # Mount point
    local mount_point
    mount_point="$(grep '^MOUNT_POINT=' "$ENV_FILE" | cut -d= -f2-)"
    mount_point="${mount_point:-$HOME/DiscordFS}"
    mkdir -p "$mount_point"

    ok "Directories created"
}

# ── Main ──────────────────────────────────────────────────────────

main() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     DiscordFS — Installer            ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
    echo ""

    check_prerequisites
    echo ""
    configure
    echo ""
    install_venv
    echo ""
    create_dirs
    echo ""
    install_service

    local mount_point
    mount_point="$(grep '^MOUNT_POINT=' "$ENV_FILE" | cut -d= -f2-)"
    mount_point="${mount_point:-$HOME/DiscordFS}"

    echo ""
    echo -e "${GREEN}Installation complete!${NC}"
    echo ""
    echo "  Start now:     systemctl --user start discordfs"
    echo "  Check status:  systemctl --user status discordfs"
    echo "  View logs:     journalctl --user -u discordfs -f"
    echo "  Stop:          systemctl --user stop discordfs"
    echo "  Unmount:       fusermount -u $mount_point"
    echo ""
    echo "  Files:         $mount_point"
    echo "  Config:        $ENV_FILE"
    echo "  Service:       $SERVICE_DIR/discordfs.service"
    echo ""
    warn "The filesystem will start automatically at each login."
    warn "Your encryption password and bot token are stored in $ENV_FILE"
    warn "This file is only readable by your user (chmod 600)."
    echo ""
}

main "$@"
