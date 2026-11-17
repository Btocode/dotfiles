# dotfiles

Ubuntu 26.04 LTS development setup for a **Lenovo IdeaPad Slim 3 15ARP10** (Ryzen 7 170 / Radeon 680M).
GNOME 50 on Wayland, Catppuccin Mocha throughout. No dock and no bar: everything a bar
would show lives in two drawers that slide in on demand, driven by an own GNOME Shell
extension, **HUD Shell**.

Beyond the usual shell and terminal config, this repo carries the fixes that made this
specific laptop usable on Linux — a kernel-level suspend workaround that uninstalls itself,
a passwordless battery charge limiter, and memory tuning for a machine that only has
12.8 GiB usable.

---

## New machine: one command

On a fresh Ubuntu 26.04 install (GNOME, Wayland), logged in as your user:

```bash
sudo apt install -y git
git clone https://github.com/Btocode/dotfiles.git ~/dotfiles
cd ~/dotfiles
./bootstrap.sh --dry-run   # see exactly what it would do
./bootstrap.sh             # do it (asks for sudo for apt and the system step)
```

Then **log out and back in once** — GNOME only loads newly installed extensions at login —
and follow the short checklist `bootstrap.sh` prints at the end.

`bootstrap.sh` is safe to re-run: every step checks first and skips what is already in place.
Run or skip single steps with `--only <step>` / `--skip <step>`:

| Step | What it does |
|---|---|
| `preflight` | Reports OS, GNOME version, session type and laptop model; warns on anything untested |
| `apt` | Ghostty, zsh + the CLI toolchain, HUD Shell's runtime libraries; makes zsh the login shell |
| `tools` | starship and lazygit (latest releases) into `~/.local/bin` |
| `fonts` | JetBrainsMono Nerd Font and Inter (variable) into `~/.local/share/fonts` |
| `links` | `install.sh`: symlinks configs, scripts, HUD themes and HUD Shell (backs up anything replaced) |
| `icons` | Colloid Catppuccin icons and the Catppuccin mauve cursor |
| `extensions` | User Themes and Caffeine from extensions.gnome.org (+ the IdeaPad toggle on that laptop), only builds that declare GNOME 50 |
| `gnome` | `gnome/apply.sh`: input, fonts, dark style, icons, enables the extensions, applies the HUD theme |
| `system` | `install-system.sh` with sudo: zram everywhere; IdeaPad battery limit and amd_pmc hooks **only** on an 83K7 |

What stays manual, by design:

- **Git identity** lives outside the repo in `~/.gitconfig.local` (the printed checklist has the commands).
- **Wallpapers** aren't vendored (licensing). Put yours in `~/Pictures/Wallpapers` and map one
  per theme in `gnome/themes/build.py` (`WALLPAPER`), then `python3 gnome/themes/build.py && hud-theme reload`.
- **Login screen theme**: `hud-login-theme install` (sudo) puts the current HUD theme on the
  GDM greeter; `hud-login-theme reset` goes back to Ubuntu's.
- **Chrome theme**: `chrome://extensions` → Developer mode → *Load unpacked* →
  `~/.local/share/hud-theme/chrome`.
- **IdeaPad keyboard-after-suspend fix** is a kernel-specific DKMS build; read
  [docs/hardware.md](docs/hardware.md) before `setup/hardware/keyboard-suspend-fix.sh`.

## The desktop

| Key | Opens |
|---|---|
| Super | GNOME's window overview |
| Super+A | **Command palette** (left): apps, Settings pages, open windows, actions (lock, power, screenshot, Do Not Disturb, night light, themes), calculator |
| Super+S | **Mission Control** (right): clock + calendar with notification bell, network/Bluetooth/volume/battery readout (opens Quick Settings), media controls, clipboard timeline, running apps, tray icons |
| Super+V | Mission Control, straight to the clipboard search |

Three complete themes — **Grid Runner** (teal console), **Ghost** (soft mauve), **Cockpit**
(amber instruments) — cover both drawers, menus, notifications, the overview, dialogs, the
lock screen, every libadwaita app, Ghostty and Chrome. Switch live with `hud-theme <name>`
or from the palette (type "theme"). Details in [docs/desktop.md](docs/desktop.md).

## What's in here

| Path | Contents |
|---|---|
| `bootstrap.sh` | Fresh machine → this desktop, idempotent |
| `home/` | `.zshrc`, `.gitconfig`, `.tmux.conf`, Starship prompt, Ghostty terminal |
| `bin/` | `hud-theme`, `battery-limit`, `wallpaper`, `bt-neckband`, `office`, `amd-pmc-fix-notify` → `~/.local/bin` |
| `gnome/extensions/` | HUD Shell (`hud-shell@btocode`) |
| `gnome/themes/` | `build.py` + templates → the `HUD-*` shell, GTK, Ghostty and Chrome themes |
| `gnome/apply.sh` | GNOME settings and extension enablement |
| `system/` | zram, sysctl tuning, IdeaPad udev rule + battery boot service, amd_pmc kernel hooks (root-owned) |
| `setup/` | One-shot provisioning scripts kept as a record — numbered fresh-install steps, plus `hardware/` and `performance/` ([details](setup/README.md)) |
| `docs/` | Why each non-obvious piece exists |

## Install by hand (instead of bootstrap)

```bash
./install.sh --dry-run     # see what it would touch
./install.sh               # symlink user config (backs up anything it replaces)
sudo ./install-system.sh   # zram; IdeaPad parts only on that laptop (or: zram | ideapad | amdpmc)
./gnome/apply.sh           # GNOME settings, extensions, HUD theme
exec zsh
```

`install.sh` only ever symlinks, and moves anything it would overwrite into
`~/.dotfiles-backup/<timestamp>/` first. Nothing is deleted.

## Highlights

**A suspend fix that removes itself.** The EC firmware on this IdeaPad leaves the keyboard
dead after s2idle resume. The workaround is a DKMS build of `amd_pmc` — but the real fix
landed upstream in 7.1.5/7.2, so shipping a permanent out-of-tree module would be wrong.
`amd-pmc-fix-check` runs from the kernel install hooks, checks whether Ubuntu's own driver
has gained the `delay_suspend` parameter yet, and uninstalls the workaround the moment it
becomes redundant. See [docs/hardware.md](docs/hardware.md).

**Battery charge limiting without root.** `battery-limit` writes the IdeaPad EC's
`conservation_mode` to cap charging around 80%. A udev rule hands the attribute to your
user, so there's no sudo and no polling daemon, and a oneshot boot service replays your
last choice because the EC can forget it after power loss.

**Memory tuning that matters.** 16 GB minus a 2 GB iGPU carve-out leaves 12.8 GiB for
Chrome, VS Code and a dev server. zram gives that back: ~3.4:1 compression with zstd, and
`swappiness=180` — high on purpose. See [docs/performance.md](docs/performance.md).

**No bar, two drawers.** HUD Shell pushes GNOME's panel off-screen and replaces it with a
command palette and a Mission Control drawer, plus three switchable themes rendered from
one template. See [docs/desktop.md](docs/desktop.md).

## Tooling

zsh + Starship (Spaceship style) · Ghostty · JetBrainsMono Nerd Font · Inter Variable UI ·
eza, bat, fd, ripgrep, fzf (+fzf-tab), zoxide, direnv, delta, lazygit, btop

## Caveats

- Written for **Ubuntu 26.04 / GNOME 50 on Wayland**. HUD Shell declares GNOME 50 only;
  other releases move shell internals around.
- The `system/` IdeaPad parts and `docs/hardware.md` are **IdeaPad Slim 3 15ARP10 (83K7)
  specific**. `bootstrap.sh` and `install-system.sh` detect the model and skip them elsewhere.
- `setup/04-utils-and-codecs.sh` installs `ubuntu-restricted-extras`, which pulls in patent-encumbered
  codecs. Check that this is OK where you live.

## License

[MIT](LICENSE). Config is free to copy; the hardware workarounds come with no warranty —
read `docs/hardware.md` before running anything under `system/`.
