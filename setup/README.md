# setup/

One-shot provisioning scripts. These are **not** idempotent config management — each was
written to be run once on a fresh install, in order, and is kept here as a record of how
this machine was actually built.

Read a script before running it. Most want root:

```bash
sudo bash setup/01-base-system.sh
```

## Numbered: a fresh Ubuntu 26.04 install, in order

| Script | What it does |
|---|---|
| `01-base-system.sh` | Base dev packages, system update, initial configuration |
| `02-debloat-and-tools.sh` | Removes preinstalled bloat, adds drivers/codecs and the CLI toolchain, sets zsh as login shell |
| `03-brave-browser.sh` | Removes Firefox, installs Brave from its official repo |
| `04-utils-and-codecs.sh` | Media codecs (`ubuntu-restricted-extras`), GNOME Sushi, ImageMagick, 7zip, mpv and friends |
| `icons-catppuccin.sh` | Colloid (default) or Tela-circle icons, Catppuccin-matched, per-user, no sudo. `colloid` | `tela` | `both` |

## `hardware/` — IdeaPad Slim 3 15ARP10 only

Do not run these on other hardware. Read [../docs/hardware.md](../docs/hardware.md) first.

| Script | What it does |
|---|---|
| `keyboard-suspend-fix.sh` | Builds the patched `amd_pmc` DKMS module that fixes the dead keyboard after s2idle resume |
| `amd-pmc-autoremove.sh` | Installs the kernel hooks that uninstall that workaround once Ubuntu ships the upstream fix |
| `clock-sync.sh` | Repairs a badly-skewed system clock and gets chrony syncing (NTS, falling back to plain NTP) |

## `performance/`

See [../docs/performance.md](../docs/performance.md) for the reasoning.

| Script | What it does |
|---|---|
| `zram-enable.sh` | Installs and configures zram: half of RAM, zstd, `swappiness=180` |
| `zram-reapply.sh` | Re-applies the config when zram is already running on package defaults — `systemctl start` on a live service is a silent no-op |
| `drain-swapfile.sh` | Pulls pages stranded in the on-disk swapfile back to RAM, with a headroom check first |

## Note

`01`–`03` were written against a specific machine state in September 2026 and will have
drifted. Treat them as documentation of intent rather than something to run blind on a
current release.
