#!/usr/bin/env bash
# Symlink the user-level dotfiles into $HOME.
# Root-owned files under system/ are NOT touched here - see install-system.sh.
#
#   ./install.sh            symlink everything (backs up what it replaces)
#   ./install.sh --dry-run  show what would happen
set -euo pipefail

DOTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="$HOME/.dotfiles-backup/$(date +%Y%m%d-%H%M%S)"
DRY=0; [[ ${1:-} == --dry-run ]] && DRY=1

link() { # link <source-in-repo> <target-in-home>
  local src="$1" dst="$2"
  [[ -e $src ]] || return 0
  if [[ -L $dst && $(readlink -f "$dst") == "$(readlink -f "$src")" ]]; then
    printf '  ok       %s\n' "${dst/#$HOME/~}"; return 0
  fi
  if [[ -e $dst || -L $dst ]]; then
    printf '  backup   %s\n' "${dst/#$HOME/~}"
    if (( ! DRY )); then mkdir -p "$BACKUP/$(dirname "${dst#$HOME/}")"; mv "$dst" "$BACKUP/${dst#$HOME/}"; fi
  fi
  printf '  link     %s\n' "${dst/#$HOME/~}"
  (( DRY )) || { mkdir -p "$(dirname "$dst")"; ln -s "$src" "$dst"; }
}

(( DRY )) && echo "DRY RUN - nothing will change"
echo "==> Shell, prompt, terminal, git, tmux"
while IFS= read -r -d '' f; do
  link "$f" "$HOME/${f#$DOTS/home/}"
done < <(find "$DOTS/home" -type f -print0)

echo "==> Scripts -> ~/.local/bin"
for f in "$DOTS"/bin/*; do link "$f" "$HOME/.local/bin/$(basename "$f")"; done

echo "==> Desktop entries"
for f in "$DOTS"/applications/*.desktop; do link "$f" "$HOME/.local/share/applications/$(basename "$f")"; done

echo "==> GNOME Shell theme"
link "$DOTS/gnome/themes/CatppuccinBar" "$HOME/.local/share/themes/CatppuccinBar"

if [[ -d $BACKUP ]]; then echo; echo "Replaced files were saved to: ${BACKUP/#$HOME/~}"; fi

cat <<'NOTE'

Next steps:
  1. Set your git identity (kept out of the repo on purpose):
       git config --file ~/.gitconfig.local user.name  "Your Name"
       git config --file ~/.gitconfig.local user.email "you@example.com"
  2. Root-owned pieces (zram, udev, kernel hooks):  sudo ./install-system.sh
  3. GNOME settings:                                ./gnome/apply.sh
  4. Restart your shell:                            exec zsh
NOTE
