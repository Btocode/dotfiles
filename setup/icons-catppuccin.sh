#!/usr/bin/env bash
# Catppuccin-matched icon themes, installed per-user (no sudo).
#
#   bash setup/icons-catppuccin.sh            Colloid (default, applied)
#   bash setup/icons-catppuccin.sh tela       Tela-circle, circular folders
#   bash setup/icons-catppuccin.sh both       install both, apply Colloid
#
# Colloid ships an official `catppuccin` folder scheme. Tela-circle takes a raw
# hex, so it gets Mocha mauve (cba6f7) directly - note: no leading '#'.
set -euo pipefail

WHAT="${1:-colloid}"
ICONS="$HOME/.local/share/icons"
MAUVE="cba6f7"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$ICONS"

get() { curl -fsSL -o "$WORK/$1.tar.gz" "$2"; tar xzf "$WORK/$1.tar.gz" -C "$WORK"; }

do_colloid() {
  echo "==> Colloid (catppuccin scheme, purple folders)"
  get colloid "https://github.com/vinceliuice/Colloid-icon-theme/archive/refs/heads/main.tar.gz"
  ( cd "$(find "$WORK" -maxdepth 1 -type d -name 'Colloid-icon-theme-*' | head -1)" \
    && ./install.sh -d "$ICONS" -s catppuccin -t purple )
}

do_tela() {
  echo "==> Tela-circle (circular folders, Mocha mauve #$MAUVE)"
  get tela "https://github.com/vinceliuice/Tela-circle-icon-theme/archive/refs/heads/master.tar.gz"
  ( cd "$(find "$WORK" -maxdepth 1 -type d -name 'Tela-circle-icon-theme-*' | head -1)" \
    && ./install.sh -d "$ICONS" -c "$MAUVE" )
}

case "$WHAT" in
  colloid) do_colloid ;;
  tela)    do_tela; gsettings set org.gnome.desktop.interface icon-theme 'Tela-circle-cba6f7-dark'; exit 0 ;;
  both)    do_colloid; do_tela ;;
  *) echo "usage: $0 [colloid|tela|both]"; exit 2 ;;
esac

gsettings set org.gnome.desktop.interface icon-theme 'Colloid-Purple-Catppuccin-Dark'
cat <<'NOTE'

Done. Switch between them with:
  gsettings set org.gnome.desktop.interface icon-theme 'Colloid-Purple-Catppuccin-Dark'
  gsettings set org.gnome.desktop.interface icon-theme 'Tela-circle-cba6f7-dark'

Do not delete the -Light / base variants: the -Dark themes symlink into them
for the icons they do not override.
NOTE
