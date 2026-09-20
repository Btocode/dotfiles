#!/usr/bin/env bash
# Papirus icons with Catppuccin Mocha folders, installed per-user (no sudo).
# The apt package lags the upstream release by months, so this pulls the tag directly.
#   bash setup/icons-papirus-catppuccin.sh [accent]     default accent: mauve
set -euo pipefail

PAPIRUS_TAG="${PAPIRUS_TAG:-20260801}"
ACCENT="${1:-mauve}"
ICONS="$HOME/.local/share/icons"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "==> Papirus $PAPIRUS_TAG -> $ICONS"
curl -fsSL -o "$WORK/papirus.tar.gz" \
  "https://github.com/PapirusDevelopmentTeam/papirus-icon-theme/archive/refs/tags/${PAPIRUS_TAG}.tar.gz"
tar xzf "$WORK/papirus.tar.gz" -C "$WORK"
SRC=$(find "$WORK" -maxdepth 1 -type d -name 'papirus-icon-theme-*' | head -1)
mkdir -p "$ICONS"
for t in Papirus Papirus-Dark Papirus-Light; do
  [ -d "$SRC/$t" ] || continue
  rm -rf "${ICONS:?}/$t"; cp -r "$SRC/$t" "$ICONS/"; echo "    $t"
done

echo "==> Catppuccin folder icons"
curl -fsSL -o "$WORK/cat.tar.gz" \
  "https://github.com/catppuccin/papirus-folders/archive/refs/heads/main.tar.gz"
tar xzf "$WORK/cat.tar.gz" -C "$WORK"
CF=$(find "$WORK" -maxdepth 1 -type d -name 'papirus-folders-*' | head -1)
cp -r "$CF"/src/* "$ICONS/Papirus/"

echo "==> Applying cat-mocha-$ACCENT"
curl -fsSL -o "$WORK/papirus-folders" \
  "https://raw.githubusercontent.com/PapirusDevelopmentTeam/papirus-folders/master/papirus-folders"
chmod +x "$WORK/papirus-folders"
for t in Papirus Papirus-Dark; do
  "$WORK/papirus-folders" -C "cat-mocha-$ACCENT" -t "$t" -u
done

gsettings set org.gnome.desktop.interface icon-theme 'Papirus-Dark'
echo
echo "Done. Other accents: papirus-folders -l | tr ' ' '\\n' | grep cat-mocha"
