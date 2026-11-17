#!/usr/bin/env python3
"""Build the HUD GNOME Shell themes (bar + menus) from one template.

    python3 gnome/themes/build.py      # writes HUD-<Name>/gnome-shell/gnome-shell.css

Each palette below fills the {{placeholders}} in template.css. Switch between
the results with `hud-theme` (bin/hud-theme). Edit template.css or a palette,
re-run this, then `hud-theme reload`.
"""
from pathlib import Path

HERE = Path(__file__).resolve().parent

MONO = '"JetBrainsMono Nerd Font", monospace'
SANS = '"Inter Variable", "Inter", sans-serif'

# hover/active treatments for panel buttons
STRIP = """
#panel .panel-button:focus,
#panel .panel-button:hover {{
  color: {fg};
  border-top-color: rgba({rgb}, 0.55);
  background-gradient-direction: vertical;
  background-gradient-start: rgba({rgb}, 0.14);
  background-gradient-end: rgba({rgb}, 0);
  box-shadow: none;
}}
#panel .panel-button:active,
#panel .panel-button:checked {{
  color: {accent};
  border-top-color: {accent};
  background-gradient-direction: vertical;
  background-gradient-start: rgba({rgb}, 0.24);
  background-gradient-end: rgba({rgb}, 0.02);
  box-shadow: none;
}}"""

SOFT = """
#panel .panel-button:focus,
#panel .panel-button:hover {{
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.06);
  box-shadow: none;
}}
#panel .panel-button:active,
#panel .panel-button:checked {{
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.11);
  box-shadow: none;
}}"""

PALETTES = {
    'GridRunner': dict(
        title='Grid Runner — teal console',
        font=MONO, size='0.9em', tracking='1px',
        accent='#94e2d5', rgb='148, 226, 213',
        fg='#cdd6f4', dim='#7f9ea0', clock='#e6fffb',
        clock_glow='0 0 8px rgba(148, 226, 213, 0.7)',
        panel_bg='#080b12', grad_start='#121826', grad_end='#080b12',
        panel_shadow='inset 0 1px 0 rgba(148, 226, 213, 0.35)',
        divider='1px solid rgba(148, 226, 213, 0.14)',
        btn_radius='0', btn_pad='0 12px', hover=STRIP,
        label='#4f6f72', warn='#fab387', crit='#f38ba8',
        menu_bg='rgba(11, 15, 23, 0.97)', banner_bg='#0e131d', lock_top='#0c1522', lock_bottom='#03050a', sys_font='"JetBrains Mono", monospace', tile_radius='4px', overview_bg='#05080d', menu_border='rgba(148, 226, 213, 0.22)',
        menu_top='2px solid #94e2d5', menu_radius='2px', item_radius='0',
        menu_glow='0 0 18px rgba(148, 226, 213, 0.10)',
        sel_bg='rgba(148, 226, 213, 0.12)', sel_fg='#94e2d5', sel_edge='#94e2d5',
        on_bg='rgba(148, 226, 213, 0.18)', on_fg='#94e2d5', on_ring='rgba(148, 226, 213, 0.45)',
    ),
    'Ghost': dict(
        title='Ghost — barely there',
        font=SANS, size='1em', tracking='0',
        accent='#cba6f7', rgb='203, 166, 247',
        fg='rgba(230, 232, 242, 0.88)', dim='rgba(230, 232, 242, 0.62)', clock='#ffffff',
        clock_glow='0 1px 3px rgba(0, 0, 0, 0.6)',
        panel_bg='transparent', grad_start='rgba(17, 17, 27, 0)', grad_end='rgba(17, 17, 27, 0.85)',
        panel_shadow='none',
        divider='0 solid transparent',
        btn_radius='6px', btn_pad='0 10px', hover=SOFT,
        label='rgba(230, 232, 242, 0.45)', warn='#f9e2af', crit='#f38ba8',
        menu_bg='rgba(17, 17, 27, 0.93)', banner_bg='rgba(24, 24, 37, 0.98)', lock_top='#1e1e2e', lock_bottom='#0e0e17', sys_font='"Ubuntu Sans", sans-serif', tile_radius='18px', overview_bg='#0c0c14', menu_border='rgba(255, 255, 255, 0.07)',
        menu_top='1px solid rgba(255, 255, 255, 0.07)', menu_radius='12px', item_radius='6px',
        menu_glow='0 10px 30px rgba(0, 0, 0, 0.45)',
        sel_bg='rgba(255, 255, 255, 0.08)', sel_fg='#ffffff', sel_edge='transparent',
        on_bg='rgba(203, 166, 247, 0.30)', on_fg='#ffffff', on_ring='rgba(203, 166, 247, 0.0)',
    ),
    'Cockpit': dict(
        title='Cockpit — amber instruments',
        font=MONO, size='0.88em', tracking='1.5px',
        accent='#f5a524', rgb='245, 165, 36',
        fg='#f5a524', dim='#b8812a', clock='#ffb547',
        clock_glow='0 0 10px rgba(255, 170, 40, 0.45)',
        panel_bg='#0b0a08', grad_start='#0e0c09', grad_end='#070605',
        panel_shadow='inset 0 1px 0 #2a2111',
        divider='1px solid #2a2111',
        btn_radius='0', btn_pad='0 12px', hover=STRIP,
        label='#6e5420', warn='#ffd166', crit='#ff5d5d',
        menu_bg='rgba(11, 10, 8, 0.97)', banner_bg='#100d09', lock_top='#140f07', lock_bottom='#040302', sys_font='"JetBrains Mono", monospace', tile_radius='0', overview_bg='#060504', menu_border='#2a2111',
        menu_top='2px solid #f5a524', menu_radius='0', item_radius='0',
        menu_glow='0 0 18px rgba(245, 165, 36, 0.08)',
        sel_bg='rgba(245, 165, 36, 0.12)', sel_fg='#ffb547', sel_edge='#f5a524',
        on_bg='rgba(245, 165, 36, 0.20)', on_fg='#ffb547', on_ring='rgba(245, 165, 36, 0.5)',
    ),
}


# Files (Nautilus) colours per theme, used by gtk-template.css
GTK = {
    'GridRunner': dict(
        g_window='#0b0f17', g_view='#0b0f17', g_header='#080b12', g_side='#080b12',
        g_solid='#0b0f17', g_header_solid='#080b12', g_side_solid='#080b12', g_title='#94e2d5',
        g_fg='#c9d4dc', g_side_fg='#8ea3a8', g_card='#101622', g_popover='#0b0f17',
        g_line='rgba(148, 226, 213, 0.16)', g_path_bg='#080b12',
        g_accent_bg='#2b8f86', g_accent_fg='#e6fffb',
        g_radius='3px', g_radius_s='2px', g_pathfont=MONO,
        g_glow='0 0 6px rgba(148, 226, 213, 0.5)',
        g_sel_bg='rgba(148, 226, 213, 0.12)', g_sel_fg='#e6fffb', g_sel_ring='rgba(148, 226, 213, 0.55)',
        g_side_edge='inset 2px 0 0 #94e2d5',
    ),
    'Ghost': dict(
        g_window='rgba(17, 17, 27, 0.95)', g_view='rgba(17, 17, 27, 0.0)', g_header='rgba(17, 17, 27, 0.0)',
        g_side='rgba(11, 11, 18, 0.45)',
        g_solid='#161622', g_header_solid='#11111b', g_side_solid='#11111b', g_title='#ffffff',
        g_fg='rgba(230, 232, 242, 0.9)', g_side_fg='rgba(230, 232, 242, 0.75)',
        g_card='rgba(255, 255, 255, 0.04)', g_popover='rgba(24, 24, 37, 0.96)',
        g_line='rgba(255, 255, 255, 0.07)', g_path_bg='transparent',
        g_accent_bg='#8f6ccf', g_accent_fg='#ffffff',
        g_radius='10px', g_radius_s='7px', g_pathfont=SANS,
        g_glow='none',
        g_sel_bg='rgba(255, 255, 255, 0.09)', g_sel_fg='#ffffff', g_sel_ring='rgba(255, 255, 255, 0.0)',
        g_side_edge='none',
    ),
    'Cockpit': dict(
        g_window='#0b0a08', g_view='#0b0a08', g_header='#0e0c09', g_side='#080706',
        g_solid='#0b0a08', g_header_solid='#0e0c09', g_side_solid='#080706', g_title='#ffb547',
        g_fg='#e8c27a', g_side_fg='#b8812a', g_card='#14110b', g_popover='#0e0c09',
        g_line='#2a2111', g_path_bg='#080706',
        g_accent_bg='#b9771a', g_accent_fg='#0b0a08',
        g_radius='0', g_radius_s='0', g_pathfont=MONO,
        g_glow='0 0 8px rgba(255, 170, 40, 0.5)',
        g_sel_bg='rgba(245, 165, 36, 0.12)', g_sel_fg='#ffb547', g_sel_ring='rgba(245, 165, 36, 0.6)',
        g_side_edge='inset 2px 0 0 #f5a524',
    ),
}


# Ghostty colours per theme (included from ~/.config/ghostty/hud-theme.conf).
# Catppuccin Mocha stays the base theme; these only shift the surface colours.
GHOSTTY = {
    'GridRunner': """\
background = #0b0f17
foreground = #cdd6f4
cursor-color = #94e2d5
cursor-text = #0b0f17
selection-background = #1d3a3c
selection-foreground = #e6fffb
split-divider-color = #1d3a3c
palette = 6=#94e2d5
palette = 14=#b5f0e6
""",
    'Ghost': """\
# Plain Catppuccin Mocha, a little more see-through
background-opacity = 0.90
""",
    'Cockpit': """\
background = #0b0a08
foreground = #e8c27a
cursor-color = #f5a524
cursor-text = #0b0a08
selection-background = #3a2a0c
selection-foreground = #ffd38a
split-divider-color = #2a2111
palette = 7=#e8c27a
palette = 8=#6e5420
palette = 15=#ffd38a
palette = 3=#f5a524
palette = 11=#ffb547
""",
}

# Chrome theme colours per theme, as [r, g, b]
CHROME = {
    'GridRunner': dict(frame=[8, 11, 18], toolbar=[14, 19, 29], tab_text=[148, 226, 213],
                       bg_tab_text=[127, 158, 160], text=[205, 214, 244],
                       omnibox_bg=[8, 11, 18], omnibox_text=[201, 212, 220], ntp=[11, 15, 23], ntp_link=[148, 226, 213]),
    'Ghost': dict(frame=[17, 17, 27], toolbar=[30, 30, 46], tab_text=[255, 255, 255],
                  bg_tab_text=[166, 173, 200], text=[205, 214, 244],
                  omnibox_bg=[24, 24, 37], omnibox_text=[205, 214, 244], ntp=[17, 17, 27], ntp_link=[203, 166, 247]),
    'Cockpit': dict(frame=[11, 10, 8], toolbar=[16, 13, 9], tab_text=[255, 181, 71],
                    bg_tab_text=[184, 129, 42], text=[232, 194, 122],
                    omnibox_bg=[8, 7, 6], omnibox_text=[232, 194, 122], ntp=[11, 10, 8], ntp_link=[245, 165, 36]),
}

# Wallpaper per theme (name matched by `wallpaper set`)
WALLPAPER = {'GridRunner': 'dark-forest', 'Ghost': 'misty-boat', 'Cockpit': 'black-hole'}


def chrome_manifest(name, c):
    import json
    return json.dumps({
        'manifest_version': 3,
        'name': f'HUD {name}',
        'version': '1.0',
        'description': 'Chrome colours matching the HUD desktop theme (generated by build.py).',
        'theme': {
            'colors': {
                'frame': c['frame'], 'frame_inactive': c['frame'],
                'frame_incognito': c['frame'], 'frame_incognito_inactive': c['frame'],
                'toolbar': c['toolbar'],
                'tab_text': c['tab_text'], 'tab_background_text': c['bg_tab_text'],
                'tab_background_text_inactive': c['bg_tab_text'],
                'bookmark_text': c['text'], 'toolbar_text': c['text'],
                'toolbar_button_icon': c['tab_text'],
                'omnibox_background': c['omnibox_bg'], 'omnibox_text': c['omnibox_text'],
                'ntp_background': c['ntp'], 'ntp_text': c['text'], 'ntp_link': c['ntp_link'],
                'button_background': c['toolbar'],
            },
            'properties': {'ntp_background_alignment': 'center'},
        },
    }, indent=2) + '\n'


def fill(text, values):
    for k, v in values.items():
        text = text.replace('{{' + k + '}}', v)
    if '{{' in text:
        raise SystemExit(f'unfilled placeholder near: {text[text.index("{{"):][:40]}')
    return text


def main():
    shell_t = (HERE / 'template.css').read_text()
    gtk_t = (HERE / 'gtk-template.css').read_text()
    gdm_t = (HERE / 'gdm-template.css').read_text()
    for name, pal in PALETTES.items():
        values = dict(pal)
        values['hover'] = pal['hover'].format(**pal)
        values.update(GTK[name])
        out = HERE / f'HUD-{name}' / 'gnome-shell' / 'gnome-shell.css'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(fill(shell_t, values))
        gout = HERE / f'HUD-{name}' / 'gtk-4.0' / 'gtk.css'
        gout.parent.mkdir(parents=True, exist_ok=True)
        gout.write_text(fill(gtk_t, values))
        tdir = HERE / f'HUD-{name}'
        (tdir / 'ghostty.conf').write_text(
            f'# Ghostty colours for HUD {name}. GENERATED by build.py.\n' + GHOSTTY[name])
        (tdir / 'chrome').mkdir(exist_ok=True)
        (tdir / 'chrome' / 'manifest.json').write_text(chrome_manifest(name, CHROME[name]))
        (tdir / 'wallpaper').write_text(WALLPAPER[name] + '\n')
        (tdir / 'gdm').mkdir(exist_ok=True)
        (tdir / 'gdm' / 'login.css').write_text(fill(gdm_t, values))
        for p in (out, gout, tdir / 'ghostty.conf', tdir / 'chrome' / 'manifest.json'):
            print(f'wrote {p.relative_to(HERE.parent.parent)}')


if __name__ == '__main__':
    main()
