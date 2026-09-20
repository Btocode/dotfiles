# ---------- PATH & toolchains ----------
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$HOME/.local/go/bin:$HOME/go/bin:$HOME/.local/share/fnm:$PATH"
export EDITOR=nvim VISUAL=nvim
command -v fnm >/dev/null && eval "$(fnm env --use-on-cd --shell zsh)"

# ---------- History ----------
HISTFILE=~/.zsh_history HISTSIZE=100000 SAVEHIST=100000
setopt SHARE_HISTORY HIST_IGNORE_ALL_DUPS HIST_IGNORE_SPACE HIST_REDUCE_BLANKS
setopt AUTO_CD INTERACTIVE_COMMENTS NO_BEEP

# ---------- Completion ----------
autoload -Uz compinit && compinit -d ~/.cache/zcompdump
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
bindkey -e
bindkey '^[[1;5C' forward-word
bindkey '^[[1;5D' backward-word
bindkey '^[[H' beginning-of-line
bindkey '^[[F' end-of-line
bindkey '^[[3~' delete-char
bindkey '^H' backward-kill-word        # Ctrl+Backspace
bindkey '^[[3;5~' kill-word            # Ctrl+Delete
bindkey '^[[Z' reverse-menu-complete   # Shift+Tab
# Up/Down search history by what you've already typed
autoload -Uz up-line-or-beginning-search down-line-or-beginning-search
zle -N up-line-or-beginning-search; zle -N down-line-or-beginning-search
bindkey '^[[A' up-line-or-beginning-search '^[OA' up-line-or-beginning-search
bindkey '^[[B' down-line-or-beginning-search '^[OB' down-line-or-beginning-search

# ---------- Fuzzy finder ----------
# Ctrl+R history · Ctrl+T files · Alt+C cd into dir · Tab = fuzzy completion menu
if command -v fdfind >/dev/null; then
  export FZF_DEFAULT_COMMAND='fdfind --type f --hidden --follow --exclude .git'
  export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
  export FZF_ALT_C_COMMAND='fdfind --type d --hidden --exclude .git'
fi
export FZF_DEFAULT_OPTS="--height 50% --layout=reverse --border=rounded --info=inline \
  --color=bg+:#313244,spinner:#f5e0dc,hl:#f38ba8,fg:#cdd6f4,header:#f38ba8,info:#cba6f7,pointer:#f5e0dc \
  --color=marker:#b4befe,fg+:#cdd6f4,prompt:#cba6f7,hl+:#f38ba8,border:#6c7086"
export FZF_CTRL_T_OPTS="--preview 'batcat --color=always --style=numbers --line-range :300 {} 2>/dev/null'"
export FZF_ALT_C_OPTS="--preview 'eza --tree --level=2 --icons --color=always {} | head -100'"
[[ -f ~/.local/share/zsh/fzf-tab/fzf-tab.plugin.zsh ]] && source ~/.local/share/zsh/fzf-tab/fzf-tab.plugin.zsh
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'eza -1 --icons --color=always $realpath'
zstyle ':fzf-tab:*' use-fzf-default-opts yes
zstyle ':completion:*' menu no

# ---------- Tools ----------
command -v fzf    >/dev/null && source <(fzf --zsh 2>/dev/null)
command -v zoxide >/dev/null && eval "$(zoxide init zsh)"
command -v direnv >/dev/null && eval "$(direnv hook zsh)"
command -v uv     >/dev/null && eval "$(uv generate-shell-completion zsh)"

# ---------- Aliases ----------
if command -v eza >/dev/null; then
  alias ls='eza --icons --group-directories-first'
  alias ll='eza -lah --icons --git --group-directories-first'
  alias lt='eza --tree --level=2 --icons'
else
  alias ll='ls -lah --color=auto'
fi
command -v batcat >/dev/null && alias bat='batcat' cat='batcat --paging=never'
command -v fdfind >/dev/null && alias fd='fdfind'
alias vim='nvim' g='git' gs='git status -sb' gl='git log --oneline --graph --decorate -20'
alias dc='docker compose' ..='cd ..' ...='cd ../..'
alias update='sudo apt update && sudo apt full-upgrade -y && sudo snap refresh && flatpak update -y && rustup update && uv self update'

# ---------- Plugins (from apt) ----------
[[ -f /usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh ]] && source /usr/share/zsh-autosuggestions/zsh-autosuggestions.zsh
[[ -f /usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh ]] && source /usr/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# ---------- Prompt ----------
command -v starship >/dev/null && eval "$(starship init zsh)"

# Blank line between commands, but not on the first prompt or right after `clear`
_prompt_gap_skip=1
_prompt_gap() { (( _prompt_gap_skip )) && _prompt_gap_skip=0 || print }
precmd_functions+=(_prompt_gap)
clear() { command clear "$@"; _prompt_gap_skip=1 }
