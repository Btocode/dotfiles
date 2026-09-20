#!/usr/bin/env bash
# Remove Firefox, install Brave (official repo). Run: sudo bash setup/03-brave-browser.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }

echo "==> Removing Firefox"
snap list firefox &>/dev/null && snap remove --purge firefox || true
apt-get purge -y firefox 2>/dev/null || true
# Stop Ubuntu from pulling the Firefox snap back in on upgrades
cat > /etc/apt/preferences.d/no-firefox <<EOF
Package: firefox*
Pin: release *
Pin-Priority: -1
EOF

echo "==> Adding Brave repository"
curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg \
  https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg
curl -fsSLo /etc/apt/sources.list.d/brave-browser-release.sources \
  https://brave-browser-apt-release.s3.brave.com/brave-browser.sources

echo "==> Installing Brave"
apt-get update
apt-get install -y brave-browser

echo "==> Making Brave the default browser for $SUDO_USER"
U="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
sudo -u "$U" HOME="/home/$U" xdg-settings set default-web-browser brave-browser.desktop
for t in x-scheme-handler/http x-scheme-handler/https text/html application/xhtml+xml; do
  sudo -u "$U" HOME="/home/$U" xdg-mime default brave-browser.desktop "$t"
done
update-alternatives --set x-www-browser /usr/bin/brave-browser-stable 2>/dev/null || true
update-alternatives --set gnome-www-browser /usr/bin/brave-browser-stable 2>/dev/null || true

echo "==> DONE: $(brave-browser --version)"
echo "    default browser: $(sudo -u "$U" HOME="/home/$U" xdg-settings get default-web-browser)"
echo "    firefox: $(snap list firefox &>/dev/null && echo STILL INSTALLED || echo removed)"
