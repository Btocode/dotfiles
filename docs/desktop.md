# Desktop notes — GNOME 50 / Wayland

The goal: no dock, no bar, nothing on screen but windows. Everything a bar would show lives
in two drawers that slide in on demand.

| Key | What opens |
|---|---|
| Super | GNOME's window overview (floating windows) |
| Super+A | **Command palette**, slides in from the left |
| Super+S | **Mission Control**, slides in from the right |
| Super+V | Mission Control, scrolled to the clipboard search |

## HUD Shell

An own extension, **HUD Shell** (`gnome/extensions/hud-shell@btocode`, linked into
`~/.local/share/gnome-shell/extensions` by `install.sh`), replaced Just Perfection. It does
only what this desktop uses; there is no preferences window — flip entries in the
`FEATURES` object at the top of `extension.js`:

| Feature | Effect |
|---|---|
| `controlDrawer` | No panel at all: it is pushed off-screen and reserves no space. Super+S opens Mission Control (`controlDrawer.js`) |
| `appDrawer` | Super+A opens the command palette (`launcher.js`) |
| `hideDash` | No dash in the overview |
| `hideQsToggles` | No Airplane Mode / Dark Style tiles in Quick Settings |
| `startOnDesktop` | Log in to the desktop, not the overview |
| `focusOnAttention` | Windows that demand attention get focused instead of a notification |
| `noWorkspacesInGrid` | No workspace strip above the app grid |
| `appGrid` | Denser app grid (8×4, 64 px icons), reset to A–Z at every login |

GNOME Shell on Wayland only (re)loads extension code at login, so after editing the
extension log out and back in.

**Mission Control** (right, Super+S), top to bottom: large clock with a notification bell
(opens GNOME's notification list over the drawer), month calendar, a status readout strip
(`statusStrip.js`: network, Bluetooth device, volume, battery; click it for GNOME's Quick
Settings), media controls (MPRIS, only while something plays), the clipboard timeline
(`clipboard.js`), running apps, and the background tray icons pinned to the bottom edge.

**Clipboard**: history is tracked by HUD Shell itself and kept in memory only; pinned
entries are saved to `~/.local/share/hud-shell/clipboard-pins.json` (mode 600). Anything a
password manager flags as secret is never recorded. This replaced Clipboard Indicator.

**Command palette** (left, Super+A): one search box over apps (GNOME's own app search),
Settings pages, open windows, actions (lock, suspend, log out, restart, power off,
screenshot, Do Not Disturb, night light, HUD themes) and a calculator. Empty search shows
frequent apps and open windows. ↵ opens, Ctrl+↵ opens a new window, Tab jumps groups.

### Testing without logging out

Run a second, invisible GNOME Shell with its own settings (so nothing touches the real
session):

```bash
mkdir -p /tmp/hudtest/glib-2.0/settings   # put enabled-extensions etc. in .../keyfile
HUD_MC_TEST=1 dbus-run-session -- env GSETTINGS_BACKEND=keyfile XDG_CONFIG_HOME=/tmp/hudtest \
  gnome-shell --headless --virtual-monitor 1920x1080 --wayland-display hudtest-0 --no-x11
```

`HUD_MC_TEST=1` opens Mission Control at startup; `HUD_DRAWER_TEST=<text>` opens the
palette with that search.

### Lessons

- **Never leave a moved actor unguarded.** Mission Control moves other extensions' tray
  icons out of the panel. When one of those extensions was disabled, its icon was
  destroyed inside the drawer, and the cleanup later re-parented the dead actor: GNOME
  Shell segfaulted, the session ended, and GNOME's crash protection set
  `disable-user-extensions` to true. Every moved actor now listens for `destroy`. If the
  desktop ever comes back with no extensions, check
  `gsettings get org.gnome.shell disable-user-extensions`.
- St measures labels before CSS `letter-spacing` is applied, so tracked text gets
  ellipsized even when it fits; such labels set `clutter_text.ellipsize = NONE`.
- A child with `y_expand: true` propagates expansion to its parents: one divider widget
  stretched the whole status strip down the drawer.

### Themes: Grid Runner, Ghost, Cockpit

Three complete looks, each covering both drawers, menus, notifications, OSD/Alt+Tab, the
overview, dialogs, the lock screen, and every libadwaita app (Settings, Files, …):

| Theme | Look |
|---|---|
| `gridrunner` | Teal console: JetBrains Mono, hairline borders, glowing clock |
| `ghost` | Soft and rounded, Inter, mauve accents; slightly see-through Files |
| `cockpit` | Amber instruments, clock with seconds |

Each theme also carries:

- **Wallpaper**: Grid Runner → `mocha-dark-forest`, Ghost → `mocha-misty-boat`, Cockpit →
  `mocha-black-hole` (set through `bin/wallpaper`).
- **Ghostty colours**: `HUD-*/ghostty.conf`, pulled in by `config-file = ?hud-theme.conf` at the
  end of the Ghostty config. `hud-theme` relinks it and triggers Ghostty's `reload-config`
  action over D-Bus (Ghostty has no reload signal; don't send it SIGUSR2).
- **Chrome theme**: `HUD-*/chrome/manifest.json`, copied to `~/.local/share/hud-theme/chrome`.
  Load that folder once via chrome://extensions → Developer mode → *Load unpacked*; after a
  switch, Chrome picks the new colours up on restart (or the extension's reload arrow).
- **Lock screen**: themed clock, user name and password field.
- **Login screen** (GDM greeter), opt-in because it needs root: `hud-login-theme install [theme]`
  copies Yaru's theme resource, appends `HUD-*/gdm/login.css` to its `gdm.css`, and selects
  the result as the `gdm-theme.gresource` alternative; `hud-login-theme reset` selects Yaru
  again. The greeter runs as the gdm user, so it only sees system fonts (JetBrains Mono,
  Ubuntu Sans), not `~/.local/share/fonts`. Preview without installing:
  `GNOME_SHELL_DATADIR=<dir with the new gdm-theme.gresource> gnome-shell --headless --mode=gdm …`.

Switch any time, live, no logout — from the command palette (type "theme") or:

```bash
hud-theme              # list, * marks the current one
hud-theme ghost        # or gridrunner / cockpit / next / reload
```

Sources are `gnome/themes/template.css` (shell) and `gnome/themes/gtk-template.css` (Files),
filled from the palettes in `gnome/themes/build.py`. After editing, run
`python3 gnome/themes/build.py && hud-theme reload`. The shell CSS `@import`s Yaru's dark
theme and overrides it; Yaru marks several panel rules `!important`, so ours are too.

The Files styles are scoped to `window.view` (Nautilus' main window carries that class),
so other GNOME apps keep their normal colours. `hud-theme` links the chosen file to
`~/.config/gtk-4.0/gtk.css`; reopen Files to pick it up.

### Why not Just Perfection / Hide Top Bar / Vitals / Clipboard Indicator

Just Perfection's profile presets silently rewrote its `panel` key to `false`, hiding the
bar after ordinary logouts. *Hide Top Bar* misbehaves with a bottom panel and throws JS
errors into the shell log. Vitals and Clipboard Indicator were replaced by Mission
Control's status strip and clipboard timeline.

### Open Bar

No GNOME 50 build exists. extensions.gnome.org silently serves the GNOME 49 build when
queried with `shell_version=50`, which then fails to load — check `metadata.json` before
assuming an extension supports your shell version.

## Terminal

Ghostty, configured in `home/.config/ghostty/config`. Notable choices:

- `theme = light:Catppuccin Latte,dark:Catppuccin Mocha` follows the GNOME light/dark switch automatically
- `gtk-single-instance = true` with a 10-minute quit delay, so new windows open instantly
- `keybind = performable:ctrl+c=copy_to_clipboard` — copies when text is selected, sends SIGINT otherwise
- `notify-on-command-finish` fires a desktop notification for commands over 10 s when the window isn't focused

**Ubuntu's packaging overrides part of this.** The `.desktop`, D-Bus and systemd units ship
with `--shell-integration-features=ssh-env`, which wins over the config file. User-level
overrides in `~/.local/share/applications` and `~/.config/systemd/user` exist to undo that.

## Fonts

Inter Variable 11 for UI, JetBrainsMono Nerd Font for the terminal. The Nerd Font patch
matters — the Starship prompt uses Nerd Font glyphs for git and language indicators.

## Wallpaper

`bin/wallpaper` switches between images in `~/Pictures/Wallpapers`:

```bash
wallpaper list        # * marks the current one
wallpaper next
wallpaper set 3       # by number, or a substring of the filename
```

It sets the background, the lock screen and `picture-uri-dark` together.

One quirk: changing the wallpaper through **GNOME Settings** copies the file to
`~/.local/share/backgrounds/<timestamp>-<name>` and points `picture-uri` there, so after a
GUI change the URI no longer references `~/Pictures/Wallpapers`. Running `wallpaper set`
again points it back at the original.

For a dark desktop with a bottom bar, prefer images whose bottom edge is flat and unbusy —
whatever sits behind the panel is what makes it readable or not.
