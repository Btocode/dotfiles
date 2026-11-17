// Command palette (Super+A, left drawer, design "L2").
//
//   enableLauncher(opts) -> undo function
//
// One search box, grouped results: APPS (GNOME's own app search, ranked by
// usage), SETTINGS pages, OPEN WINDOWS, ACTIONS (lock, power, screenshot,
// Do Not Disturb, night light, HUD themes) and an inline CALCULATOR.
// Empty search shows your most-used apps and open windows.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const MAX_PER_GROUP = {apps: 6, settings: 4, windows: 5, actions: 5};

const SETTINGS = [
    ['wifi', 'Wi-Fi', 'wireless network internet'],
    ['network', 'Network', 'ethernet vpn proxy wired'],
    ['bluetooth', 'Bluetooth', 'headphones neckband devices pair'],
    ['display', 'Displays', 'monitor resolution scale night light refresh'],
    ['sound', 'Sound', 'volume audio speakers microphone output input'],
    ['power', 'Power', 'battery suspend performance power mode'],
    ['multitasking', 'Multitasking', 'windows workspaces hot corner'],
    ['background', 'Appearance', 'wallpaper background dark style accent'],
    ['applications', 'Apps', 'default applications permissions'],
    ['notifications', 'Notifications', 'do not disturb banners'],
    ['search', 'Search', 'search locations'],
    ['online-accounts', 'Online Accounts', 'google microsoft accounts'],
    ['wellbeing', 'Wellbeing', 'screen time breaks'],
    ['mouse', 'Mouse & Touchpad', 'pointer scroll tap click trackpad'],
    ['keyboard', 'Keyboard', 'shortcuts layout input source typing'],
    ['color', 'Color Management', 'profile calibration'],
    ['printers', 'Printers', 'print scanner'],
    ['privacy', 'Privacy & Security', 'location camera microphone lock screen'],
    ['sharing', 'Sharing', 'remote desktop file sharing ssh'],
    ['system', 'System', 'about users date time region language updates'],
    ['ubuntu', 'Ubuntu Desktop', 'dock desktop icons'],
    ['universal-access', 'Accessibility', 'a11y zoom contrast screen reader'],
];

const esc = s => GLib.markup_escape_text(s, -1);

// highlight the first case-insensitive occurrence of q in text (Pango markup)
function mark(text, q) {
    if (!q)
        return esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0)
        return esc(text);
    return `${esc(text.slice(0, i))}<u><b>${esc(text.slice(i, i + q.length))}</b></u>${esc(text.slice(i + q.length))}`;
}

const matches = (q, ...fields) => fields.some(f => f && f.toLowerCase().includes(q.toLowerCase()));

// ── calculator: a small, safe expression evaluator (no eval) ──
function calculate(src) {
    const s = src.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '');
    if (!/^[-+*/^%().\deE]+$|^[-+*/^%().\deEa-z]+$/i.test(s) || !/\d/.test(s) || !/[-+*/^%(]/.test(s.slice(1)))
        return null;
    let i = 0;
    const FN = {sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, abs: Math.abs, round: Math.round};
    const CONST = {pi: Math.PI, e: Math.E};
    const peek = () => s[i];
    const num = () => {
        const m = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(s.slice(i));
        if (!m)
            throw new Error('number');
        i += m[0].length;
        return parseFloat(m[0]);
    };
    const atom = () => {
        if (peek() === '(') {
            i++;
            const v = expr();
            if (s[i++] !== ')')
                throw new Error(')');
            return v;
        }
        if (peek() === '-') {
            i++;
            return -atom();
        }
        if (peek() === '+') {
            i++;
            return atom();
        }
        const w = /^[a-z]+/i.exec(s.slice(i));
        if (w) {
            const name = w[0].toLowerCase();
            i += w[0].length;
            if (name in CONST)
                return CONST[name];
            if (name in FN && peek() === '(')
                return FN[name](atom());
            throw new Error('name');
        }
        return num();
    };
    const power = () => {
        let v = atom();
        if (peek() === '^') {
            i++;
            v = Math.pow(v, power());
        }
        if (peek() === '%' && !/[\d(.a-z]/i.test(s[i + 1] ?? '')) {
            i++;
            v /= 100;
        }
        return v;
    };
    const term = () => {
        let v = power();
        while (peek() === '*' || peek() === '/' || (peek() === '%' && /[\d(.]/.test(s[i + 1] ?? ''))) {
            const op = s[i++];
            const r = power();
            v = op === '*' ? v * r : op === '/' ? v / r : v % r;
        }
        return v;
    };
    const expr = () => {
        let v = term();
        while (peek() === '+' || peek() === '-') {
            const op = s[i++];
            const r = term();
            v = op === '+' ? v + r : v - r;
        }
        return v;
    };
    try {
        const v = expr();
        if (i !== s.length || !Number.isFinite(v))
            return null;
        return Math.abs(v) >= 1e15 || (Math.abs(v) < 1e-6 && v !== 0)
            ? v.toExponential(6) : String(parseFloat(v.toPrecision(12)));
    } catch {
        return null;
    }
}

// Keep a scroll view strictly vertical: pin the child to the viewport width
// (so long labels ellipsize instead of widening the content) and snap any
// horizontal scroll back to 0. hscrollbar_policy NEVER only hides the bar;
// touchpads could still scroll sideways.
function verticalOnly(scroll, child) {
    scroll.connect('notify::width', () => child.set_width(scroll.width));
    scroll.hadjustment.connect('notify::value', adj => {
        if (adj.value !== 0)
            adj.value = 0;
    });
}

export function enableLauncher(opts) {
    const {width, iconSize, slideMs, themeCmd, Meta} = opts;
    const undo = [];
    const appSys = Shell.AppSystem.get_default();
    const usage = Shell.AppUsage.get_default();
    const tracker = Shell.WindowTracker.get_default();
    const spawn = argv => {
        try {
            Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
        } catch (e) {
            logError(e, 'hud-shell launcher');
        }
    };

    const notifSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.notifications'});
    const colorSettings = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.color'});
    const ACTIONS = () => [
        {name: 'Lock screen', keys: 'lock', icon: 'system-lock-screen-symbolic', hint: 'super+L', run: () => Main.screenShield?.lock(true)},
        {name: 'Suspend', keys: 'sleep suspend', icon: 'media-playback-pause-symbolic', run: () => spawn(['systemctl', 'suspend'])},
        {name: 'Log out…', keys: 'logout sign out', icon: 'system-log-out-symbolic', run: () => spawn(['gnome-session-quit', '--logout'])},
        {name: 'Restart…', keys: 'reboot restart', icon: 'system-reboot-symbolic', run: () => spawn(['gnome-session-quit', '--reboot'])},
        {name: 'Power off…', keys: 'shutdown power off', icon: 'system-shutdown-symbolic', run: () => spawn(['gnome-session-quit', '--power-off'])},
        {name: 'Screenshot', keys: 'screenshot capture print screen record', icon: 'camera-photo-symbolic', hint: 'print', run: () => Main.screenshotUI?.open()},
        {name: notifSettings.get_boolean('show-banners') ? 'Do Not Disturb: turn on' : 'Do Not Disturb: turn off', keys: 'dnd do not disturb notifications quiet focus',
            icon: 'notifications-disabled-symbolic', run: () => notifSettings.set_boolean('show-banners', !notifSettings.get_boolean('show-banners'))},
        {name: colorSettings.get_boolean('night-light-enabled') ? 'Night Light: turn off' : 'Night Light: turn on', keys: 'night light blue warm',
            icon: 'night-light-symbolic', run: () => colorSettings.set_boolean('night-light-enabled', !colorSettings.get_boolean('night-light-enabled'))},
        {name: 'Theme: Grid Runner', keys: 'theme hud grid runner teal', icon: 'applications-graphics-symbolic', run: () => spawn([themeCmd, 'gridrunner'])},
        {name: 'Theme: Ghost', keys: 'theme hud ghost soft', icon: 'applications-graphics-symbolic', run: () => spawn([themeCmd, 'ghost'])},
        {name: 'Theme: Cockpit', keys: 'theme hud cockpit amber', icon: 'applications-graphics-symbolic', run: () => spawn([themeCmd, 'cockpit'])},
    ];

    // ── layer: backdrop + drawer on the left ──
    const layer = new St.Widget({name: 'hudLauncherLayer', reactive: true, visible: false, layout_manager: new Clutter.FixedLayout()});
    const backdrop = new St.Widget({style_class: 'hud-drawer-backdrop', reactive: true});
    const drawer = new St.BoxLayout({style_class: 'hud-drawer hud-pal', vertical: true, reactive: true});
    layer.add_child(backdrop);
    layer.add_child(drawer);
    Main.layoutManager.addTopChrome(layer);

    const titleRow = new St.BoxLayout({style_class: 'hud-pal-titlerow'});
    const title = new St.Label({text: 'LAUNCH', style_class: 'hud-drawer-title', x_expand: true});
    title.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    const keysHint = new St.Label({text: '↑↓  ↵', style_class: 'hud-pal-keys', y_align: Clutter.ActorAlign.CENTER});
    keysHint.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    titleRow.add_child(title);
    titleRow.add_child(keysHint);
    const entry = new St.Entry({style_class: 'hud-drawer-search', hint_text: 'Apps, settings, windows, actions, 2+2…', can_focus: true, x_expand: true});
    entry.set_primary_icon(new St.Icon({icon_name: 'edit-find-symbolic', style_class: 'hud-drawer-search-icon'}));
    const list = new St.BoxLayout({vertical: true, style_class: 'hud-drawer-list', x_expand: true});
    const scroll = new St.ScrollView({
        style_class: 'hud-drawer-scroll', x_expand: true, y_expand: true,
        hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC, overlay_scrollbars: true,
    });
    scroll.set_child(list);
    verticalOnly(scroll, list);
    const foot = new St.Label({text: '↵ open   ctrl+↵ new window   esc close', style_class: 'hud-pal-foot'});
    foot.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    drawer.add_child(titleRow);
    drawer.add_child(entry);
    drawer.add_child(scroll);
    drawer.add_child(foot);

    let rows = [];   // {btn, run, runAlt}
    let sel = 0;
    let grab = null;
    let open = false;

    const select = i => {
        if (!rows.length)
            return;
        sel = Math.max(0, Math.min(rows.length - 1, i));
        rows.forEach((r, k) => (k === sel ? r.btn.add_style_class_name('hud-drawer-selected') : r.btn.remove_style_class_name('hud-drawer-selected')));
        const btn = rows[sel].btn;
        const adj = scroll.vadjustment;
        if (btn.y < adj.value)
            adj.value = Math.max(0, btn.y - 24);
        else if (btn.y + btn.height > adj.value + adj.page_size)
            adj.value = btn.y + btn.height - adj.page_size;
    };

    const group = text => {
        const l = new St.Label({text, style_class: 'hud-drawer-letter'});
        l.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        list.add_child(l);
    };

    // one result row: icon actor, markup title, optional dim subtitle/hint
    const addRow = ({icon, markup, sub = null, hint = null, run, runAlt = null}) => {
        const box = new St.BoxLayout({style_class: 'hud-drawer-row-box', x_expand: true});
        box.add_child(icon);
        const text = new St.BoxLayout({vertical: true, y_align: Clutter.ActorAlign.CENTER, x_expand: true});
        const name = new St.Label({style_class: 'hud-drawer-name'});
        name.clutter_text.set_markup(markup);
        text.add_child(name);
        if (sub)
            text.add_child(new St.Label({text: sub, style_class: 'hud-drawer-desc'}));
        box.add_child(text);
        if (hint) {
            const h = new St.Label({text: hint, style_class: 'hud-pal-hint', y_align: Clutter.ActorAlign.CENTER});
            h.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            box.add_child(h);
        }
        const btn = new St.Button({style_class: 'hud-drawer-row', child: box, x_expand: true, can_focus: false, track_hover: true,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO});
        const idx = rows.length;
        btn.connect('clicked', (_b, mouse) => activate(idx, mouse === 2));
        btn.connect('notify::hover', () => btn.hover && select(idx));
        list.add_child(btn);
        rows.push({btn, run, runAlt});
    };
    const symIcon = name => new St.Icon({icon_name: name, style_class: 'hud-pal-sym', y_align: Clutter.ActorAlign.CENTER});

    const activate = (i, alt = false) => {
        const r = rows[i];
        if (!r)
            return;
        hide();
        (alt && r.runAlt ? r.runAlt : r.run)();
    };

    const appRow = (app, q) => addRow({
        icon: app.create_icon_texture(iconSize),
        markup: mark(app.get_name(), q),
        sub: app.get_description()?.split('\n')[0] ?? null,
        hint: app.get_n_windows() > 0 ? 'running' : null,
        run: () => app.activate(),
        runAlt: () => app.open_new_window(-1),
    });

    const windows = () => global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null)
        .filter(w => !w.skip_taskbar);

    const windowRow = (w, q) => {
        const app = tracker.get_window_app(w);
        addRow({
            icon: app ? app.create_icon_texture(iconSize) : symIcon('focus-windows-symbolic'),
            markup: mark(w.get_title() || app?.get_name() || 'Window', q),
            sub: app?.get_name() ?? null,
            hint: w.minimized ? 'minimized' : null,
            run: () => Main.activateWindow(w),
        });
    };

    const render = () => {
        list.destroy_all_children();
        rows = [];
        const q = entry.get_text().trim();

        if (!q) {
            // empty: most-used apps, then open windows
            const most = usage.get_most_used().filter(a => a.app_info?.should_show?.() ?? true).slice(0, 8);
            if (most.length) {
                group('FREQUENT');
                most.forEach(a => appRow(a, ''));
            }
            const wins = windows().slice(0, 8);
            if (wins.length) {
                group('OPEN WINDOWS');
                wins.forEach(w => windowRow(w, ''));
            }
            select(0);
            return;
        }

        // calculator first: a sum is unambiguous intent
        const result = calculate(q);
        if (result !== null) {
            group('CALCULATOR');
            addRow({
                icon: symIcon('accessories-calculator-symbolic'),
                markup: `<b>= ${esc(result)}</b>`,
                sub: `${q}   ·   ↵ copies the result`,
                run: () => St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, result),
            });
        }

        let apps = [];
        for (const g of Shell.AppSystem.search(q))
            apps = apps.concat(g.sort((a, b) => usage.compare(a, b)));
        apps = apps.map(id => appSys.lookup_app(id)).filter(Boolean).slice(0, MAX_PER_GROUP.apps);
        if (apps.length) {
            group('APPS');
            apps.forEach(a => appRow(a, q));
        }

        const settings = SETTINGS.filter(([id, name, kw]) => matches(q, name, kw, id)).slice(0, MAX_PER_GROUP.settings);
        if (settings.length) {
            group('SETTINGS');
            for (const [id, name] of settings) {
                addRow({
                    icon: symIcon('preferences-system-symbolic'),
                    markup: mark(name, q),
                    sub: `Settings › ${name}`,
                    run: () => spawn(['gnome-control-center', id]),
                });
            }
        }

        const wins = windows().filter(w => matches(q, w.get_title(), tracker.get_window_app(w)?.get_name()))
            .slice(0, MAX_PER_GROUP.windows);
        if (wins.length) {
            group('OPEN WINDOWS');
            wins.forEach(w => windowRow(w, q));
        }

        const acts = ACTIONS().filter(a => matches(q, a.name, a.keys)).slice(0, MAX_PER_GROUP.actions);
        if (acts.length) {
            group('ACTIONS');
            for (const a of acts)
                addRow({icon: symIcon(a.icon), markup: mark(a.name, q), hint: a.hint ?? null, run: a.run});
        }

        if (!rows.length)
            list.add_child(new St.Label({text: `Nothing for “${q}”`, style_class: 'hud-drawer-desc'}));
        scroll.vadjustment.value = 0;
        select(0);
    };

    entry.clutter_text.connect('text-changed', render);
    entry.clutter_text.connect('key-press-event', (_a, event) => {
        const key = event.get_key_symbol();
        const ctrl = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0;
        const step = {[Clutter.KEY_Down]: 1, [Clutter.KEY_Up]: -1, [Clutter.KEY_Page_Down]: 8, [Clutter.KEY_Page_Up]: -8}[key];
        if (step) {
            select(sel + step);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Tab) {
            // jump to the first row of the next group
            const next = rows.findIndex((r, k) => k > sel && r.btn.get_previous_sibling() instanceof St.Label);
            select(next >= 0 ? next : 0);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
            activate(sel, ctrl);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Escape) {
            hide();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    });
    backdrop.connect('button-press-event', () => {
        hide();
        return Clutter.EVENT_STOP;
    });

    const layoutFor = () => {
        const m = Main.layoutManager.primaryMonitor;
        layer.set_position(m.x, m.y);
        layer.set_size(m.width, m.height);
        backdrop.set_size(m.width, m.height);
        drawer.set_position(0, 0);
        drawer.set_size(Math.min(width, m.width), m.height);
    };

    const show = (initial = '') => {
        if (open)
            return;
        if (Main.overview.visible)
            Main.overview.hide();
        open = true;
        layoutFor();
        entry.set_text(initial);
        render();
        layer.show();
        grab = Main.pushModal(layer, {actionMode: Shell.ActionMode.POPUP});
        drawer.remove_all_transitions();
        backdrop.remove_all_transitions();
        drawer.translation_x = -drawer.width;
        backdrop.opacity = 0;
        drawer.ease({translation_x: 0, duration: slideMs, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        backdrop.ease({opacity: 255, duration: slideMs, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        entry.grab_key_focus();
    };

    const hide = () => {
        if (!open)
            return;
        open = false;
        if (grab) {
            Main.popModal(grab);
            grab = null;
        }
        backdrop.ease({opacity: 0, duration: slideMs, mode: Clutter.AnimationMode.EASE_IN_QUAD});
        drawer.ease({
            translation_x: -drawer.width, duration: slideMs, mode: Clutter.AnimationMode.EASE_IN_CUBIC,
            onComplete: () => {
                if (!open)
                    layer.hide();
            },
        });
    };

    Main.overview.connectObject('showing', hide, layer);

    // Super+A: take over from the overview's app grid; give it back on undo
    const controls = Main.overview._overview._controls;
    const kb = new Gio.Settings({schema_id: 'org.gnome.shell.keybindings'});
    Main.wm.removeKeybinding('toggle-application-view');
    Main.wm.addKeybinding('toggle-application-view', kb, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
        () => (open ? hide() : show()));

    // headless testing only: HUD_DRAWER_TEST=<text> opens with that search
    const testQuery = GLib.getenv('HUD_DRAWER_TEST');
    if (testQuery !== null) {
        let testId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 4, () => {
            testId = 0;
            show(testQuery);
            return GLib.SOURCE_REMOVE;
        });
        undo.push(() => testId && GLib.source_remove(testId));
    }

    undo.push(() => {
        if (grab)
            Main.popModal(grab);
        grab = null;
        Main.wm.removeKeybinding('toggle-application-view');
        Main.wm.addKeybinding('toggle-application-view', kb, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            controls._toggleAppsPage.bind(controls));
        Main.overview.disconnectObject(layer);
    });

    return () => {
        while (undo.length) {
            try {
                undo.pop()();
            } catch (e) {
                logError(e, 'hud-shell launcher: undo failed');
            }
        }
        Main.layoutManager.removeChrome(layer);
        layer.destroy();
    };
}
