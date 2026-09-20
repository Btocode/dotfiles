# Desktop notes — GNOME 50 / Wayland

The goal: no dock, nothing hovering at the top of the screen, and a single small bar at the
bottom that gets out of the way in fullscreen.

## Bottom pill bar

[Just Perfection](https://extensions.gnome.org/extension/3843/just-perfection/) moves the
panel and hides the dash. The relevant keys:

| Key | Value | Effect |
|---|---|---|
| `panel` | `true` | Show the panel at all |
| `top-panel-position` | `1` | Move it to the bottom |
| `dash` | `false` | No dash in the overview |

`gnome/themes/CatppuccinBar` restyles it as a floating rounded pill — Catppuccin Mocha base
with a mauve border, detached from the screen edge by a margin. It `@import`s Yaru's dark
shell CSS rather than replacing it, so it only overrides `#panel` rules and keeps working
across Ubuntu theme updates. Enable it through *User Themes* in GNOME Tweaks.

### The panel key gets reset

**Applying a Just Perfection profile preset silently rewrites `panel` to `false`**, which
hides the bar completely and looks like the extension broke. Observed twice, most recently
after an ordinary logout. `top-panel-position` survived both times — it's specifically
`panel` that gets clobbered.

Fix without logging out (Just Perfection applies dconf changes live):

```bash
dconf write /org/gnome/shell/extensions/just-perfection/panel true
```

When inspecting the settings, dump the whole thing — `top-panel-position` sorts near the end
alphabetically and is easy to cut off with `head`:

```bash
dconf dump /org/gnome/shell/extensions/just-perfection/
```

### Fullscreen hiding

Don't install *Hide Top Bar* for this. With the panel at the bottom it misbehaves and throws
JS errors into the shell log. GNOME's native fullscreen behaviour already hides the panel.

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
