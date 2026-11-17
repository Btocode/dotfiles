#!/usr/bin/env bash
# Apply the GNOME desktop settings: no bar, no dock, HUD themes, input tweaks.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> HUD Shell (own extension: no bar, Super+A palette, Super+S Mission Control)"
# Replaces Just Perfection. Needs a re-login the first time (Wayland only
# discovers new extensions at shell startup).
for e in just-perfection-desktop@just-perfection Vitals@CoreCoding.com clipboard-indicator@tudmotu.com; do
  gnome-extensions disable "$e" 2>/dev/null || true   # replaced by HUD Shell
done
gnome-extensions enable hud-shell@btocode 2>/dev/null || \
  gsettings set org.gnome.shell enabled-extensions \
    "$(gsettings get org.gnome.shell enabled-extensions | sed "s/]$/, 'hud-shell@btocode']/; s/\[, /[/")"

echo "==> Input"
gsettings set org.gnome.desktop.peripherals.keyboard delay 250
gsettings set org.gnome.desktop.peripherals.keyboard repeat-interval 25
gsettings set org.gnome.desktop.peripherals.touchpad tap-to-click true
gsettings set org.gnome.desktop.peripherals.touchpad natural-scroll true

echo "==> Visual"
gsettings set org.gnome.desktop.interface color-scheme prefer-dark
gsettings set org.gnome.desktop.interface font-name 'Inter Variable 11'
gsettings set org.gnome.desktop.interface show-battery-percentage true
gsettings set org.gnome.settings-daemon.plugins.color night-light-enabled true
gsettings set org.gnome.settings-daemon.plugins.color night-light-schedule-automatic true
gsettings set org.gnome.settings-daemon.plugins.color night-light-temperature 3400

echo "==> Icons, accent, shell theme"
# Icons and cursors are installed by setup/icons-catppuccin.sh
gsettings set org.gnome.desktop.interface icon-theme 'Colloid-Purple-Catppuccin-Dark'
gsettings set org.gnome.desktop.interface cursor-theme 'catppuccin-mocha-mauve-cursors'
# 'purple' is the nearest GNOME native accent to Catppuccin mauve (#cba6f7)
gsettings set org.gnome.desktop.interface accent-color 'purple'
# The HUD bar themes need User Themes enabled; its schema is not on
# the default path, so it must be set with --schemadir.
gnome-extensions enable user-theme@gnome-shell-extensions.gcampax.github.com 2>/dev/null || true
# hud-theme selects the shell theme and links Files' gtk.css; it remembers
# the last choice, so re-running apply.sh keeps the current look.
"$HERE/../bin/hud-theme" reload || true

echo "==> Never show the Ubuntu dock"
gnome-extensions disable ubuntu-dock@ubuntu.com 2>/dev/null || true

cat <<'NOTE'

Done. Log out and back in once so GNOME Shell picks up HUD Shell.
NOTE
