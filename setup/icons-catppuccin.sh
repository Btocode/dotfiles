#!/usr/bin/env bash
# Catppuccin-matched icon themes, installed per-user (no sudo).
#
#   bash setup/icons-catppuccin.sh            Colloid (default, applied)
#   bash setup/icons-catppuccin.sh tela       Tela-circle, circular folders
#   bash setup/icons-catppuccin.sh both       install both, apply Colloid
#   bash setup/icons-catppuccin.sh cursor     Catppuccin Mocha mauve cursors
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

do_cursor() {
  echo "==> Catppuccin Mocha mauve cursors"
  local T=catppuccin-mocha-mauve-cursors
  curl -fsSL -o "$WORK/cur.zip" \
    "https://github.com/catppuccin/cursors/releases/download/v2.0.0/${T}.zip"
  unzip -q "$WORK/cur.zip" -d "$WORK/cur"
  rm -rf "${ICONS:?}/$T"
  cp -r "$WORK/cur/$T" "$ICONS/"

  # Backfill the legacy hash-named shapes the release omits (notably col-resize).
  # X11 apps look cursors up by these MD5 names; a missing one shows the black-X
  # fallback instead of the themed pointer.
  local C="$ICONS/$T/cursors" Y=/usr/share/icons/Yaru/cursors
  if [ -d "$Y" ]; then
    local h tgt
    for h in $(find "$Y" -maxdepth 1 -regextype posix-extended -regex '.*/[0-9a-f]{32}' -printf '%f\n'); do
      [ -e "$C/$h" ] && continue
      tgt=$(basename "$(readlink "$Y/$h")") || continue
      [ -n "$tgt" ] && [ -e "$C/$tgt" ] && ln -s "$tgt" "$C/$h"
    done
  fi

  gsettings set org.gnome.desktop.interface cursor-theme "$T"
  # XWayland/X11 apps read ~/.icons/default, not gsettings
  mkdir -p "$HOME/.icons/default"
  printf '[Icon Theme]\nName=Default\nComment=Default cursor theme\nInherits=%s\n' "$T" \
    > "$HOME/.icons/default/index.theme"
  echo "    applied (also wrote ~/.icons/default for X11 apps)"
}

case "$WHAT" in
  colloid) do_colloid ;;
  cursor)  do_cursor; exit 0 ;;
  tela)    do_tela; gsettings set org.gnome.desktop.interface icon-theme 'Tela-circle-cba6f7-dark'; exit 0 ;;
  both)    do_colloid; do_tela; do_cursor ;;
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
