#!/usr/bin/env bash
# Apply the GNOME desktop settings: bottom pill bar, no dock, input tweaks.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Just Perfection (bottom panel, no dash)"
dconf load /org/gnome/shell/extensions/just-perfection/ < "$HERE/just-perfection.dconf"

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

echo "==> Never show the Ubuntu dock"
gnome-extensions disable ubuntu-dock@ubuntu.com 2>/dev/null || true

cat <<'NOTE'

Done. If the bottom bar disappears after a login, a Just Perfection profile
preset has reset it. Fix without logging out:
  dconf write /org/gnome/shell/extensions/just-perfection/panel true
NOTE
