#!/usr/bin/env bash
set -euo pipefail

# ── DiscordFS Uninstaller ─────────────────────────────────────────
# Stops the service, removes systemd unit, venv, config, and cache.
# ──────────────────────────────────────────────────────────────────

CONFIG_DIR="$HOME/.config/discordfs"
DATA_DIR="$HOME/.local/share/discordfs"
CACHE_DIR="$HOME/.cache/discordfs"
SERVICE_FILE="$HOME/.config/systemd/user/discordfs.service"
ENV_FILE="$CONFIG_DIR/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Read mount point from config ──────────────────────────────────

MOUNT_POINT="$HOME/DiscordFS"
if [[ -f "$ENV_FILE" ]]; then
    mp="$(grep '^MOUNT_POINT=' "$ENV_FILE" | cut -d= -f2- || true)"
    [[ -n "$mp" ]] && MOUNT_POINT="$mp"
fi

# ── Unmount ───────────────────────────────────────────────────────

unmount() {
    if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
        info "Unmounting $MOUNT_POINT..."
        if command -v fusermount3 &>/dev/null; then
            fusermount3 -u "$MOUNT_POINT"
        else
            fusermount -u "$MOUNT_POINT"
        fi
        ok "Unmounted"
    fi
}

# ── Stop and remove systemd service ───────────────────────────────

remove_service() {
    if [[ -f "$SERVICE_FILE" ]]; then
        info "Stopping and disabling systemd service..."
        systemctl --user stop discordfs.service 2>/dev/null || true
        systemctl --user disable discordfs.service 2>/dev/null || true
        rm -f "$SERVICE_FILE"
        systemctl --user daemon-reload
        ok "Service removed"
    else
        info "No systemd service found"
    fi
}

# ── Remove installed files ────────────────────────────────────────

remove_files() {
    echo ""
    warn "The following will be removed:"
    [[ -d "$DATA_DIR" ]]   && echo "  - $DATA_DIR (virtual environment)"
    [[ -d "$CACHE_DIR" ]]  && echo "  - $CACHE_DIR (file cache)"
    [[ -d "$CONFIG_DIR" ]] && echo "  - $CONFIG_DIR (config + database)"
    echo ""

    read -rp "Proceed? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        info "Aborted. Service was already removed, files kept."
        return
    fi

    [[ -d "$DATA_DIR" ]]   && rm -rf "$DATA_DIR"   && ok "Removed $DATA_DIR"
    [[ -d "$CACHE_DIR" ]]  && rm -rf "$CACHE_DIR"  && ok "Removed $CACHE_DIR"
    [[ -d "$CONFIG_DIR" ]] && rm -rf "$CONFIG_DIR"  && ok "Removed $CONFIG_DIR"

    # Only remove mount point if empty
    if [[ -d "$MOUNT_POINT" ]]; then
        if rmdir "$MOUNT_POINT" 2>/dev/null; then
            ok "Removed empty mount point $MOUNT_POINT"
        else
            warn "Mount point $MOUNT_POINT is not empty, skipping"
        fi
    fi
}

# ── Main ──────────────────────────────────────────────────────────

main() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║     DiscordFS — Uninstaller          ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
    echo ""

    unmount
    remove_service
    remove_files

    echo ""
    echo -e "${GREEN}DiscordFS has been uninstalled.${NC}"
    echo ""
}

main "$@"
