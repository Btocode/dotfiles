#!/usr/bin/env bash
# Essential utilities + media codecs for Ubuntu 26.04.
# Written 2026-09-20. Run:  sudo bash setup/04-utils-and-codecs.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash setup/04-utils-and-codecs.sh"; exit 1; }

echo "==> Updating package lists"
apt-get update -qq

echo "==> Media codecs (H.264/H.265/MP3/AAC) + MS core fonts"
# EULA for ttf-mscorefonts must be pre-accepted or the install hangs on a dialog
echo ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true \
  | debconf-set-selections
DEBIAN_FRONTEND=noninteractive apt-get install -y ubuntu-restricted-extras

echo "==> Desktop experience"
apt-get install -y \
  gnome-sushi \
  nautilus-admin \
  7zip 7zip-rar \
  gparted

echo "==> Image + media CLI"
apt-get install -y imagemagick webp mpv

echo "==> Dev/system CLI extras"
apt-get install -y hyperfine nmap pipx

echo
echo "==> Applying the 6 pending security updates (mutter/GNOME)"
apt-get upgrade -y

echo
echo "Done. Log out and back in so Files picks up Sushi (spacebar preview)."
