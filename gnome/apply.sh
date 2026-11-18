#!/usr/bin/env bash
# Apply the GNOME desktop settings: no bar, no dock, HUD themes, input tweaks.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Enable an extension now if the shell already knows it; otherwise (freshly
# installed — Wayland only discovers extensions at login) add it to the list
# GNOME reads at the next login.
enable_ext() {
  local uuid="$1"
  gnome-extensions enable "$uuid" 2>/dev/null && return 0
  gsettings set org.gnome.shell enabled-extensions "$(
    gsettings get org.gnome.shell enabled-extensions | python3 -c '
import ast, sys
cur = sys.stdin.read().strip()
l = [] if cur.startswith("@as") else ast.literal_eval(cur)
if sys.argv[1] not in l:
    l.append(sys.argv[1])
print(l)' "$uuid")"
}

echo "==> Extensions: HUD Shell (no bar, Super+A palette, Super+S Mission Control)"
for e in just-perfection-desktop@just-perfection Vitals@CoreCoding.com clipboard-indicator@tudmotu.com; do
  gnome-extensions disable "$e" 2>/dev/null || true   # replaced by HUD Shell
done
# GNOME's crash protection can switch every user extension off
gsettings set org.gnome.shell disable-user-extensions false
for e in hud-shell@btocode user-theme@gnome-shell-extensions.gcampax.github.com caffeine@patapon.info; do
  enable_ext "$e"
done
# battery conservation toggle, only where that extension was installed (IdeaPad)
[[ -d $HOME/.local/share/gnome-shell/extensions/ideapad@laurento.frittella ]] && enable_ext ideapad@laurento.frittella

echo "==> Shortcuts and default terminal (Ghostty)"
# Super+T / Super+Return / Ctrl+Alt+T → Ghostty, Super+B Brave, Super+E Files,
# Super+C VS Code, Ctrl+Shift+Esc Resources
grep -v '^#' "$HERE/keybindings.dconf" | dconf load /org/gnome/settings-daemon/plugins/media-keys/
# GNOME opens terminals through xdg-terminal-exec, which reads
# ~/.config/xdg-terminals.list (linked by install.sh)
gsettings set org.gnome.desktop.default-applications.terminal exec 'xdg-terminal-exec'
gsettings set org.gnome.desktop.default-applications.terminal exec-arg '--'
# Workspaces: Super+N goes to workspace N, Super+Shift+N moves the window there.
# Super+N used to launch dock favourites; the dock is hidden, so it is freed up.
for i in 1 2 3 4; do
  gsettings set org.gnome.shell.keybindings switch-to-application-$i "[]"
  gsettings set org.gnome.desktop.wm.keybindings switch-to-workspace-$i "['<Super>$i']"
  gsettings set org.gnome.desktop.wm.keybindings move-to-workspace-$i "['<Super><Shift>$i']"
done

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
# hud-theme selects the shell theme and links Files' gtk.css; it remembers
# the last choice, so re-running apply.sh keeps the current look.
"$HERE/../bin/hud-theme" reload || true

echo "==> Never show the Ubuntu dock"
gnome-extensions disable ubuntu-dock@ubuntu.com 2>/dev/null || true

cat <<'NOTE'

Done. Log out and back in once so GNOME Shell picks up HUD Shell.
NOTE
