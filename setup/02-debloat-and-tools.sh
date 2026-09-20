#!/usr/bin/env bash
# Follow-up: debloat, drivers/codecs, CLI tools, login shell. Run: sudo bash setup/02-debloat-and-tools.sh
set -uo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }
REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
export DEBIAN_FRONTEND=noninteractive

install() {
  local ok=()
  for p in "$@"; do
    c=$(apt-cache policy "$p" 2>/dev/null | awk '/Candidate:/{print $2}')
    if [[ -n "$c" && "$c" != "(none)" ]]; then ok+=("$p"); else echo "!! Skipped: $p"; fi
  done
  [[ ${#ok[@]} -gt 0 ]] && apt-get install -y --no-install-recommends "${ok[@]}"
  return 0
}

echo "==> Protecting core desktop packages from autoremove"
# Removing apps drops the ubuntu-desktop metapackage; marking its members manual
# stops autoremove from taking GNOME components with it.
for meta in ubuntu-desktop ubuntu-desktop-minimal; do
  apt-cache depends --no-pre-depends --no-suggests --no-conflicts --no-breaks --no-replaces --no-enhances "$meta" 2>/dev/null \
    | awk '/Depends:|Recommends:/{print $2}' | grep -v "^<" | sort -u | xargs -r apt-mark manual >/dev/null 2>&1
done

echo "==> Removing non-development apps"
remove=(rhythmbox 'rhythmbox-*' shotwell 'shotwell-*' transmission-gtk transmission-common
  remmina 'remmina-*' simple-scan deja-dup sysprof usb-creator-gtk usb-creator-common rygel
  'libreoffice*' 'thunderbird*' gnome-snapshot)
apt-get purge -y "${remove[@]}" 2>&1 | grep -E '^(Purg|Remv|E:)' || true
for s in snap-store thunderbird; do snap list "$s" &>/dev/null && snap remove --purge "$s"; done

echo "==> Drivers, firmware tools, codecs (AMD Radeon 680M / Realtek)"
install mesa-vulkan-drivers mesa-utils vulkan-tools vainfo gstreamer1.0-vaapi \
  ffmpeg libavcodec-extra gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav \
  lm-sensors fwupd
fwupdmgr refresh --force &>/dev/null; fwupdmgr get-updates 2>/dev/null | head -20 || true

echo "==> GNOME extension deps + software center with Flathub"
install gir1.2-gtop-2.0 gnome-software gnome-software-plugin-flatpak

echo "==> CLI tools"
install zsh zsh-autosuggestions zsh-syntax-highlighting tmux neovim ripgrep fd-find bat eza fzf zoxide \
  git-delta jq yq tree htop btop fastfetch unzip zip p7zip-full xclip wl-clipboard httpie ncdu \
  tealdeer direnv openssh-server net-tools dnsutils gh shellcheck

echo "==> Login shell"
if command -v zsh >/dev/null; then chsh -s /usr/bin/zsh "$REAL_USER"; else chsh -s /bin/bash "$REAL_USER"; fi
echo "Login shell: $(getent passwd "$REAL_USER" | cut -d: -f7)"

echo "==> Cleanup (review list below)"
apt-get -s autoremove | awk '/^Remv/{print "  would remove:", $2}'
apt-get -y autoremove --purge && apt-get clean

echo; echo "==> DONE. Log out and back in."
