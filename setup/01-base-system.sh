#!/usr/bin/env bash
# System-level dev setup for Ubuntu 26.04 — run with: sudo bash setup/01-base-system.sh
set -uo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }
REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
export DEBIAN_FRONTEND=noninteractive

echo "==> Updating system"
apt-get update && apt-get -y full-upgrade

# Install only packages that exist in the repo, so one missing name doesn't abort everything
install() {
  local ok=() missing=()
  for p in "$@"; do
    c=$(apt-cache policy "$p" 2>/dev/null | awk "/Candidate:/{print \$2}"); if [[ -n "$c" && "$c" != "(none)" ]]; then ok+=("$p"); else missing+=("$p"); fi
  done
  [[ ${#ok[@]} -gt 0 ]] && apt-get install -y --no-install-recommends "${ok[@]}"
  [[ ${#missing[@]} -gt 0 ]] && echo "!! Skipped (not in repo): ${missing[*]}"
  return 0
}

echo "==> Core build tools"
install build-essential git git-lfs pkg-config cmake ninja-build autoconf automake libtool \
  libssl-dev zlib1g-dev libffi-dev libreadline-dev libsqlite3-dev libbz2-dev liblzma-dev \
  ca-certificates gnupg software-properties-common apt-transport-https

echo "==> CLI essentials"
install zsh zsh-autosuggestions zsh-syntax-highlighting tmux neovim \
  ripgrep fd-find bat eza fzf zoxide git-delta jq yq tree htop btop fastfetch \
  unzip zip p7zip-full xclip wl-clipboard curl wget httpie ncdu tealdeer direnv \
  openssh-client openssh-server net-tools dnsutils gh shellcheck

echo "==> Python"
install python3-pip python3-venv python3-dev pipx

echo "==> Docker"
install docker.io docker-compose-v2 docker-buildx
systemctl enable --now docker 2>/dev/null
usermod -aG docker "$REAL_USER"

echo "==> Fonts"
install fonts-jetbrains-mono fonts-firacode fonts-cascadia-code fonts-noto-color-emoji fonts-noto-cjk
fc-cache -f >/dev/null

echo "==> Desktop tools"
install gnome-tweaks gnome-shell-extension-manager dconf-editor flatpak gnome-software-plugin-flatpak
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo 2>/dev/null

echo "==> Kernel tweaks (file watchers for VS Code/webpack, less swapping)"
cat > /etc/sysctl.d/99-dev.conf <<EOF
fs.inotify.max_user_watches=524288
fs.inotify.max_user_instances=1024
vm.swappiness=10
EOF
sysctl --system >/dev/null

echo "==> Firewall (allow SSH, deny other incoming)"
install ufw
ufw allow OpenSSH >/dev/null && ufw --force enable

echo "==> Making zsh the default shell for $REAL_USER"
command -v zsh >/dev/null && chsh -s /usr/bin/zsh "$REAL_USER"

apt-get -y autoremove
echo
echo "==> DONE. Log out and back in (for docker group + zsh)."
