#!/usr/bin/env bash
# bootstrap.sh — turn a fresh Ubuntu 26.04 (GNOME 50, Wayland) install into
# this desktop. Safe to re-run: every step checks before it changes anything.
#
#   ./bootstrap.sh                 everything (asks for sudo for apt + system)
#   ./bootstrap.sh --dry-run       print what would happen, change nothing
#   ./bootstrap.sh --only fonts    run one step (see STEPS below)
#   ./bootstrap.sh --skip system   run everything except one step
#
# STEPS: preflight apt tools fonts links icons extensions gnome system
#
# After it finishes: log out and back in once (Wayland only loads new GNOME
# Shell extensions at login), then follow the printed checklist.
set -euo pipefail

DOTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STEPS=(preflight apt tools fonts links icons extensions gnome system)
DRY=0
ONLY=""
SKIP=""
while (( $# )); do
  case "$1" in
    --dry-run) DRY=1 ;;
    --only) ONLY="$2"; shift ;;
    --skip) SKIP="$2"; shift ;;
    -h|--help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
warn() { printf '\033[1;33m    ! %s\033[0m\n' "$*"; }
run()  { if (( DRY )); then printf '    [dry] %s\n' "$*"; else "$@"; fi; }
have() { command -v "$1" >/dev/null 2>&1; }
want() { [[ -n $ONLY ]] && { [[ $1 == "$ONLY" ]]; return; }; [[ $1 != "$SKIP" ]]; }

ARCH="$(uname -m)"   # x86_64 | aarch64
LOCAL_BIN="$HOME/.local/bin"
export PATH="$LOCAL_BIN:$PATH"   # so re-runs see tools this script installed
FONT_DIR="$HOME/.local/share/fonts"
TODO=()              # things only a human can finish, printed at the end

# grep -q exits early, which makes fc-list die of SIGPIPE under pipefail
font_present() { fc-list : family 2>/dev/null | grep -F "$1" >/dev/null; }

is_ideapad_83k7() { [[ $(cat /sys/class/dmi/id/product_name 2>/dev/null) == 83K7* ]]; }

# latest release tag of a GitHub repo, read from the /releases/latest redirect
# (no API call, so no unauthenticated rate limit)
gh_latest_tag() { # gh_latest_tag owner/repo
  curl -fsSIL -o /dev/null -w '%{url_effective}' "https://github.com/$1/releases/latest" | sed 's|.*/tag/||'
}

# ── steps ──────────────────────────────────────────────────────────────────

step_preflight() {
  say "Preflight"
  . /etc/os-release
  info "OS: $PRETTY_NAME   arch: $ARCH   session: ${XDG_SESSION_TYPE:-?} / ${XDG_CURRENT_DESKTOP:-?}"
  [[ ${ID:-} == ubuntu ]] || warn "Not Ubuntu — package names below may differ."
  [[ ${VERSION_ID:-} == 26.04 ]] || warn "Written for 26.04; you have ${VERSION_ID:-?}. Expect small differences."
  local shell_major
  shell_major=$(gnome-shell --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)
  [[ $shell_major == 50 ]] || warn "HUD Shell is written for GNOME Shell 50 (found ${shell_major:-none})."
  [[ ${XDG_SESSION_TYPE:-} == wayland ]] || warn "Not a Wayland session; untested."
  case "$ARCH" in x86_64|aarch64) ;; *) warn "Unsupported arch $ARCH for the downloaded tools." ;; esac
  if is_ideapad_83k7; then info "Hardware: IdeaPad Slim 3 15ARP10 — laptop-specific fixes will be offered."
  else info "Hardware: $(cat /sys/class/dmi/id/product_name 2>/dev/null) — IdeaPad-only parts will be skipped."; fi
}

step_apt() {
  say "Packages (apt)"
  local pkgs=(
    # shell + CLI toolchain used by home/.zshrc
    zsh tmux git curl wget unzip xz-utils
    eza bat fd-find ripgrep fzf zoxide direnv git-delta btop
    # terminal
    ghostty
    # runtime deps of HUD Shell's status strip (NetworkManager, Bluetooth)
    gir1.2-nm-1.0 gir1.2-gnomebluetooth-3.0
    # Ctrl+Shift+Esc task manager
    resources
    # compiles the login-screen theme (bin/hud-login-theme)
    libglib2.0-dev-bin
    # clipboard CLI, emoji font, fontconfig tools
    wl-clipboard fonts-noto-color-emoji fontconfig
    # handy for dconf inspection
    dconf-cli
  )
  local missing=()
  for p in "${pkgs[@]}"; do
    dpkg-query -W -f='${Status}' "$p" 2>/dev/null | grep -q "install ok installed" || missing+=("$p")
  done
  if (( ${#missing[@]} == 0 )); then info "all ${#pkgs[@]} packages present"; return; fi
  info "installing: ${missing[*]}"
  run sudo apt-get update -qq
  run sudo apt-get install -y "${missing[@]}"
  if [[ $(getent passwd "$USER" | cut -d: -f7) != */zsh ]]; then
    info "making zsh your login shell"
    # sudo is already authenticated for apt; plain chsh would prompt again
    run sudo chsh -s "$(command -v zsh || echo /usr/bin/zsh)" "$USER"
  fi
}

step_tools() {
  say "Tools not in apt (into ~/.local/bin)"
  run mkdir -p "$LOCAL_BIN"
  local tmp; tmp=$(mktemp -d); trap 'rm -rf "$tmp"' RETURN

  if have starship; then info "starship $(starship --version | head -1 | awk '{print $2}') present"
  else
    local t; [[ $ARCH == aarch64 ]] && t=aarch64-unknown-linux-musl || t=x86_64-unknown-linux-gnu
    info "installing starship"
    run curl -fsSL -o "$tmp/starship.tgz" "https://github.com/starship/starship/releases/latest/download/starship-$t.tar.gz"
    run tar -xzf "$tmp/starship.tgz" -C "$LOCAL_BIN" starship
  fi

  if have lazygit; then info "lazygit $(lazygit --version | grep -oE '(^|, )version=[0-9.]+' | head -1 | cut -d= -f2) present"
  else
    local a; [[ $ARCH == aarch64 ]] && a=arm64 || a=x86_64
    info "installing lazygit"
    if (( DRY )); then info "[dry] download latest jesseduffield/lazygit Linux_$a release"
    else
      local v; v=$(gh_latest_tag jesseduffield/lazygit)
      curl -fsSL -o "$tmp/lazygit.tgz" "https://github.com/jesseduffield/lazygit/releases/download/$v/lazygit_${v#v}_Linux_${a}.tar.gz"
      tar -xzf "$tmp/lazygit.tgz" -C "$LOCAL_BIN" lazygit
    fi
  fi
}

step_fonts() {
  say "Fonts (into ~/.local/share/fonts)"
  local tmp; tmp=$(mktemp -d); trap 'rm -rf "$tmp"' RETURN
  local changed=0

  if font_present "JetBrainsMono Nerd Font"; then info "JetBrainsMono Nerd Font present"
  else
    info "installing JetBrainsMono Nerd Font"
    run mkdir -p "$FONT_DIR/JetBrainsMonoNerd"
    run curl -fsSL -o "$tmp/jbm.tar.xz" https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.tar.xz
    run tar -xJf "$tmp/jbm.tar.xz" -C "$FONT_DIR/JetBrainsMonoNerd" --wildcards '*.ttf'
    changed=1
  fi

  if font_present "Inter Variable"; then info "Inter Variable present"
  else
    info "installing Inter (variable)"
    if (( DRY )); then info "[dry] download latest rsms/inter release zip"
    else
      local v; v=$(gh_latest_tag rsms/inter)
      curl -fsSL -o "$tmp/inter.zip" "https://github.com/rsms/inter/releases/download/$v/Inter-${v#v}.zip"
      mkdir -p "$FONT_DIR/Inter"
      unzip -qjo "$tmp/inter.zip" 'InterVariable*.ttf' -d "$FONT_DIR/Inter"
    fi
    changed=1
  fi
  (( changed )) && run fc-cache -f "$FONT_DIR" >/dev/null
  return 0
}

step_links() {
  say "Dotfiles (symlinks, backs up anything replaced)"
  if (( DRY )); then BOOTSTRAP=1 "$DOTS/install.sh" --dry-run | sed 's/^/    /'
  else BOOTSTRAP=1 "$DOTS/install.sh" | sed 's/^/    /'; fi
  # theme files are generated; make sure they exist even on a fresh clone
  [[ -f $DOTS/gnome/themes/HUD-GridRunner/gnome-shell/gnome-shell.css ]] || run python3 "$DOTS/gnome/themes/build.py"
}

step_icons() {
  say "Icons and cursor (Catppuccin)"
  if [[ -d $HOME/.local/share/icons/Colloid-Purple-Catppuccin-Dark && -d $HOME/.local/share/icons/catppuccin-mocha-mauve-cursors ]]; then
    info "Colloid icons + Catppuccin cursor present"
  else
    run bash "$DOTS/setup/icons-catppuccin.sh" colloid
    run bash "$DOTS/setup/icons-catppuccin.sh" cursor
  fi
}

step_extensions() {
  say "GNOME Shell extensions (extensions.gnome.org)"
  local major; major=$(gnome-shell --version | grep -oE '[0-9]+' | head -1)
  local list=(user-theme@gnome-shell-extensions.gcampax.github.com caffeine@patapon.info)
  is_ideapad_83k7 && list+=(ideapad@laurento.frittella)
  local tmp; tmp=$(mktemp -d); trap 'rm -rf "$tmp"' RETURN
  for uuid in "${list[@]}"; do
    if [[ -d $HOME/.local/share/gnome-shell/extensions/$uuid || -d /usr/share/gnome-shell/extensions/$uuid ]]; then
      info "$uuid present"; continue
    fi
    info "installing $uuid"
    if (( DRY )); then info "[dry] fetch build for GNOME $major"; continue; fi
    local url
    url=$(curl -fsSL "https://extensions.gnome.org/extension-info/?uuid=$uuid&shell_version=$major" |
      grep -oE '"download_url": *"[^"]+"' | cut -d'"' -f4)
    [[ -n $url ]] || { warn "no build of $uuid for GNOME $major"; continue; }
    curl -fsSL -o "$tmp/ext.zip" "https://extensions.gnome.org$url"
    # e.g.o silently serves an older build when none matches; check before installing
    if ! unzip -p "$tmp/ext.zip" metadata.json | grep -q "\"$major\""; then
      warn "$uuid: newest build does not list GNOME $major — skipped"; continue
    fi
    gnome-extensions install --force "$tmp/ext.zip"
  done
}

step_gnome() {
  say "GNOME settings, HUD Shell, theme"
  if (( DRY )); then info "[dry] run gnome/apply.sh"; return; fi
  "$DOTS/gnome/apply.sh" | sed 's/^/    /'
  if ! ls "$HOME/Pictures/Wallpapers"/* >/dev/null 2>&1; then
    TODO+=("Put wallpapers in ~/Pictures/Wallpapers and map them per theme in gnome/themes/build.py (WALLPAPER), then: python3 gnome/themes/build.py && hud-theme reload")
  fi
}

step_system() {
  say "System pieces (sudo): zram everywhere, IdeaPad fixes only on an 83K7"
  if (( DRY )); then info "[dry] sudo ./install-system.sh"; return; fi
  sudo "$DOTS/install-system.sh" | sed 's/^/    /'
  if is_ideapad_83k7; then
    TODO+=("IdeaPad keyboard-after-suspend fix (DKMS, kernel-specific): read docs/hardware.md, then sudo bash setup/hardware/keyboard-suspend-fix.sh")
  fi
}

# ── run ────────────────────────────────────────────────────────────────────

(( DRY )) && echo "DRY RUN — nothing will change"
[[ -n $ONLY && ! " ${STEPS[*]} " =~ " $ONLY " ]] && { echo "unknown step: $ONLY (${STEPS[*]})"; exit 2; }
for s in "${STEPS[@]}"; do want "$s" && "step_$s"; done

[[ -f $HOME/.gitconfig.local ]] || TODO+=('Git identity: git config --file ~/.gitconfig.local user.name "Your Name"; git config --file ~/.gitconfig.local user.email "you@example.com"')
TODO+=("Chrome theme (optional): chrome://extensions → Developer mode → Load unpacked → ~/.local/share/hud-theme/chrome")

cat <<EOF

$(printf '\033[1;32m')Done.$(printf '\033[0m') Now:
  1. Log out and back in once — GNOME only loads new extensions (HUD Shell) at login.
  2. Then try: Super (command palette), Super+A (window overview), Super+S (Mission Control), Super+V (clipboard),
     and 'hud-theme ghost' / 'hud-theme cockpit'.
EOF
n=3
for t in "${TODO[@]}"; do echo "  $n. $t"; n=$((n + 1)); done
