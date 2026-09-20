# dotfiles

Ubuntu 26.04 LTS development setup for a **Lenovo IdeaPad Slim 3 15ARP10** (Ryzen 7 170 / Radeon 680M).
GNOME 50 on Wayland, Catppuccin Mocha throughout, no dock, panel moved to the bottom.

Beyond the usual shell and terminal config, this repo carries the fixes that made this
specific laptop usable on Linux — a kernel-level suspend workaround that uninstalls itself,
a passwordless battery charge limiter, and memory tuning for a machine that only has
12.8 GiB usable.

---

## What's in here

| Path | Contents |
|---|---|
| `home/` | `.zshrc`, `.gitconfig`, `.tmux.conf`, Starship prompt, Ghostty terminal |
| `bin/` | `battery-limit`, `wallpaper`, `amd-pmc-fix-notify` → `~/.local/bin` |
| `system/` | zram, sysctl tuning, IdeaPad udev rule, amd_pmc kernel hooks (root-owned) |
| `gnome/` | Just Perfection dconf, the Catppuccin pill-bar shell theme, `apply.sh` |
| `setup/` | One-shot provisioning scripts — numbered fresh-install steps, plus `hardware/` and `performance/` ([details](setup/README.md)) |
| `docs/` | Why each non-obvious piece exists |

## Install

```bash
git clone https://github.com/Btocode/dotfiles.git ~/dotfiles
cd ~/dotfiles

./install.sh --dry-run     # see what it would touch
./install.sh               # symlink user config (backs up anything it replaces)

sudo ./install-system.sh   # zram + udev + kernel hooks (or: zram | ideapad | amdpmc)
./gnome/apply.sh           # bottom bar, no dock, input and visual tweaks
exec zsh
```

`install.sh` only ever symlinks, and moves anything it would overwrite into
`~/.dotfiles-backup/<timestamp>/` first. Nothing is deleted.

Your git identity is deliberately **not** in this repo. Set it once:

```bash
git config --file ~/.gitconfig.local user.name  "Your Name"
git config --file ~/.gitconfig.local user.email "you@example.com"
```

## Highlights

**A suspend fix that removes itself.** The EC firmware on this IdeaPad leaves the keyboard
dead after s2idle resume. The workaround is a DKMS build of `amd_pmc` — but the real fix
landed upstream in 7.1.5/7.2, so shipping a permanent out-of-tree module would be wrong.
`amd-pmc-fix-check` runs from the kernel install hooks, checks whether Ubuntu's own driver
has gained the `delay_suspend` parameter yet, and uninstalls the workaround the moment it
becomes redundant. See [docs/hardware.md](docs/hardware.md).

**Battery charge limiting without root.** `battery-limit` writes the IdeaPad EC's
`conservation_mode` to cap charging around 60%. A udev rule hands the attribute to your
user, so there's no sudo and no polling daemon — and because the value lives in the
embedded controller, it survives reboots and even a reinstall.

**Memory tuning that matters.** 16 GB minus a 2 GB iGPU carve-out leaves 12.8 GiB for
Chrome, VS Code and a dev server. zram gives that back: ~3.4:1 compression with zstd, and
`swappiness=180` — high on purpose. See [docs/performance.md](docs/performance.md).

**A floating pill bar at the bottom.** GNOME's panel moved to the bottom via Just
Perfection, restyled as a rounded Catppuccin Mocha pill that imports Yaru dark rather than
replacing it. No dock, ever. See [docs/desktop.md](docs/desktop.md).

## Tooling

zsh + Starship (Spaceship style) · Ghostty · JetBrainsMono Nerd Font · Inter Variable UI ·
eza, bat, fd, ripgrep, fzf (+fzf-tab), zoxide, direnv, delta, lazygit, btop

## Caveats

- Written for **Ubuntu 26.04 / GNOME 50 on Wayland**. Earlier GNOME releases move dconf paths around.
- The `system/` and `docs/hardware.md` parts are **IdeaPad Slim 3 15ARP10 specific**. Don't
  install the udev rule or DKMS workaround on other hardware — check your own model first.
- `setup/04-utils-and-codecs.sh` installs `ubuntu-restricted-extras`, which pulls in patent-encumbered
  codecs. Check that this is OK where you live.
- Wallpapers aren't vendored here; the `wallpaper` script expects them in `~/Pictures/Wallpapers`.
  The Catppuccin set came from [orangci/walls-catppuccin-mocha](https://github.com/orangci/walls-catppuccin-mocha).

## License

[MIT](LICENSE). Config is free to copy; the hardware workarounds come with no warranty —
read `docs/hardware.md` before running anything under `system/`.
