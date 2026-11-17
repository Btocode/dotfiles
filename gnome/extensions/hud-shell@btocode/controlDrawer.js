// Mission Control: the right-hand drawer that replaces the panel entirely.
//
//   enableControlDrawer(opts) -> undo function
//
// Super+S (the Quick Settings shortcut) slides it in from the right. It holds:
//   clock + month calendar with a notification bell (opens GNOME's list over
//   the drawer), a status readout strip (opens Quick Settings), background
//   tray icons (moved in from the hidden panel, menus intact), the media
//   player, a clipboard timeline, and running apps.
// Super+V / Super+M open it scrolled to the clipboard search.
//
// Everything that is moved in is moved back on undo.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {buildClipboard} from './clipboard.js';
import {buildStatusStrip} from './statusStrip.js';

// St measures labels before CSS letter-spacing is applied, so tracked text
// gets ellipsized even when it fits. Let these labels draw at full width.
const full = label => {
    label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    return label;
};

// ── small widgets ──────────────────────────────────────────────────────────

function sectionTitle(text) {
    return full(new St.Label({text, style_class: 'hud-mc-section'}));
}

// ── the drawer ─────────────────────────────────────────────────────────────

export function enableControlDrawer(opts) {
    const {width, slideMs, tileIcon, setStruts} = opts;
    const undo = [];
    const panelBox = Main.layoutManager.panelBox;

    // 1. No bar: push the panel off-screen and stop it reserving space
    setStruts(false);
    const hidePanel = () => {
        panelBox.translation_y = -(panelBox.height + 200);
    };
    hidePanel();
    panelBox.connectObject('notify::height', hidePanel, 'notify::translation-y', () => {
        if (panelBox.translation_y > -panelBox.height)
            hidePanel();
    }, opts.owner);
    undo.push(() => {
        panelBox.disconnectObject(opts.owner);
        panelBox.translation_y = 0;
        setStruts(true);
    });

    // 2. The layer: dim backdrop + the drawer on the right
    const layer = new St.Widget({name: 'hudMcLayer', reactive: true, visible: false,
        layout_manager: new Clutter.FixedLayout()});
    const backdrop = new St.Widget({style_class: 'hud-mc-backdrop', reactive: true});
    const drawer = new St.BoxLayout({style_class: 'hud-mc', vertical: true, reactive: true});
    layer.add_child(backdrop);
    layer.add_child(drawer);
    Main.layoutManager.addTopChrome(layer);

    const scroll = new St.ScrollView({
        style_class: 'hud-mc-scroll', x_expand: true, y_expand: true,
        hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC,
        overlay_scrollbars: true,
    });
    const content = new St.BoxLayout({vertical: true, style_class: 'hud-mc-content', x_expand: true});
    scroll.set_child(content);
    drawer.add_child(scroll);

    // ── clock + calendar ──
    const clockBox = new St.BoxLayout({vertical: true, style_class: 'hud-mc-clockbox'});
    const timeRow = new St.BoxLayout({style_class: 'hud-mc-timerow'});
    const timeLabel = full(new St.Label({style_class: 'hud-mc-time'}));
    const secLabel = full(new St.Label({style_class: 'hud-mc-seconds', y_align: Clutter.ActorAlign.END}));
    timeRow.add_child(timeLabel);
    timeRow.add_child(secLabel);
    const dateLabel = full(new St.Label({style_class: 'hud-mc-date'}));
    clockBox.add_child(timeRow);
    clockBox.add_child(dateLabel);
    // header: clock on the left, notification bell on the right
    const headerRow = new St.BoxLayout({style_class: 'hud-mc-header'});
    clockBox.x_expand = true;
    headerRow.add_child(clockBox);
    const bellBox = new St.BoxLayout({style_class: 'hud-mc-bell-box'});
    bellBox.add_child(new St.Icon({icon_name: 'preferences-system-notifications-symbolic', style_class: 'hud-mc-bell-icon'}));
    const bellCount = new St.Label({style_class: 'hud-mc-bell-count', visible: false, y_align: Clutter.ActorAlign.CENTER});
    bellBox.add_child(bellCount);
    const bell = new St.Button({style_class: 'hud-mc-bell', child: bellBox, y_align: Clutter.ActorAlign.START, can_focus: true, track_hover: true});
    headerRow.add_child(bell);
    content.add_child(headerRow);

    const cal = new St.BoxLayout({vertical: true, style_class: 'hud-mc-cal'});
    const calHead = new St.BoxLayout({style_class: 'hud-mc-cal-head'});
    const prevBtn = new St.Button({label: '‹', style_class: 'hud-mc-cal-nav'});
    const monthLabel = full(new St.Label({style_class: 'hud-mc-cal-month', x_expand: true, x_align: Clutter.ActorAlign.CENTER}));
    const nextBtn = new St.Button({label: '›', style_class: 'hud-mc-cal-nav'});
    calHead.add_child(prevBtn);
    calHead.add_child(monthLabel);
    calHead.add_child(nextBtn);
    const calGrid = new St.Widget({style_class: 'hud-mc-cal-grid', layout_manager: new Clutter.GridLayout()});
    cal.add_child(calHead);
    cal.add_child(calGrid);
    content.add_child(cal);

    let calMonth = new Date();
    calMonth.setDate(1);
    const weekStart = Shell.util_get_week_start();
    const renderCalendar = () => {
        calGrid.destroy_all_children();
        const grid = calGrid.layout_manager;
        const now = new Date();
        monthLabel.text = calMonth.toLocaleDateString(undefined, {month: 'long', year: 'numeric'}).toUpperCase();
        // weekday headings
        const ref = new Date(2024, 0, 7); // a Sunday
        for (let i = 0; i < 7; i++) {
            const d = new Date(ref);
            d.setDate(ref.getDate() + ((weekStart + i) % 7));
            const l = new St.Label({text: d.toLocaleDateString(undefined, {weekday: 'narrow'}), style_class: 'hud-mc-cal-wd', x_expand: true, x_align: Clutter.ActorAlign.CENTER});
            grid.attach(l, i, 0, 1, 1);
        }
        const first = new Date(calMonth);
        const offset = (first.getDay() - weekStart + 7) % 7;
        const start = new Date(first);
        start.setDate(1 - offset);
        for (let k = 0; k < 42; k++) {
            const d = new Date(start);
            d.setDate(start.getDate() + k);
            const cls = ['hud-mc-cal-day'];
            if (d.getMonth() !== calMonth.getMonth())
                cls.push('hud-mc-cal-other');
            if (d.toDateString() === now.toDateString())
                cls.push('hud-mc-cal-today');
            if (d.getDay() === 0 || d.getDay() === 6)
                cls.push('hud-mc-cal-weekend');
            const l = new St.Label({text: String(d.getDate()), style_class: cls.join(' '), x_expand: true, x_align: Clutter.ActorAlign.CENTER});
            grid.attach(l, k % 7, 1 + Math.floor(k / 7), 1, 1);
        }
    };
    prevBtn.connect('clicked', () => {
        calMonth.setMonth(calMonth.getMonth() - 1);
        renderCalendar();
    });
    nextBtn.connect('clicked', () => {
        calMonth.setMonth(calMonth.getMonth() + 1);
        renderCalendar();
    });
    monthLabel.reactive = true;
    monthLabel.connect('button-press-event', () => {
        calMonth = new Date();
        calMonth.setDate(1);
        renderCalendar();
        return Clutter.EVENT_STOP;
    });

    const clockSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
    const tickClock = () => {
        const now = GLib.DateTime.new_now_local();
        const h24 = clockSettings.get_string('clock-format') === '24h';
        timeLabel.text = now.format(h24 ? '%H:%M' : '%I:%M');
        secLabel.text = now.format(':%S') + (h24 ? '' : now.format(' %p'));
        dateLabel.text = now.format('%A · %e %B %Y · W%V').toUpperCase().replace(/\s+/g, ' ');
    };

    // ── running apps ──
    const appsTitle = sectionTitle('ACTIVE APPS');
    content.add_child(appsTitle);
    const appsBox = new St.BoxLayout({style_class: 'hud-mc-apps', vertical: true});
    content.add_child(appsBox);
    const tracker = Shell.WindowTracker.get_default();
    const appSys = Shell.AppSystem.get_default();
    const renderApps = () => {
        appsBox.destroy_all_children();
        const apps = appSys.get_running().filter(a => a.get_windows().some(w => !w.skip_taskbar));
        apps.sort((a, b) => a.get_name().localeCompare(b.get_name()));
        if (!apps.length) {
            appsBox.add_child(new St.Label({text: 'Nothing running', style_class: 'hud-mc-empty'}));
            return;
        }
        let row = null;
        apps.forEach((app, i) => {
            if (i % 4 === 0) {
                row = new St.BoxLayout({style_class: 'hud-mc-approw'});
                appsBox.add_child(row);
            }
            const tile = new St.BoxLayout({vertical: true, style_class: 'hud-mc-tile-box'});
            tile.add_child(app.create_icon_texture(tileIcon));
            const n = app.get_windows().filter(w => !w.skip_taskbar).length;
            tile.add_child(new St.Label({
                text: app.get_name() + (n > 1 ? ` ×${n}` : ''),
                style_class: 'hud-mc-tile-name', x_align: Clutter.ActorAlign.CENTER,
            }));
            const btn = new St.Button({
                style_class: 'hud-mc-tile', child: tile, track_hover: true,
                button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO, x_expand: false,
            });
            if (app === tracker.focus_app)
                btn.add_style_class_name('hud-mc-tile-focused');
            btn.connect('clicked', (_b, mouse) => {
                if (mouse === 2) {
                    app.open_new_window(-1);
                } else if (app === tracker.focus_app) {
                    app.get_windows().forEach(w => w.minimize());
                    renderApps();
                    return;
                } else {
                    app.activate();
                }
                hide();
            });
            row.add_child(btn);
        });
    };

    // ── media (MPRIS) ──
    const mediaSection = new St.BoxLayout({vertical: true, visible: false});
    mediaSection.add_child(sectionTitle('NOW PLAYING'));
    const mediaBox = new St.BoxLayout({style_class: 'hud-mc-media'});
    const mediaText = new St.BoxLayout({vertical: true, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
    const mediaTitle = new St.Label({style_class: 'hud-mc-media-title'});
    const mediaArtist = new St.Label({style_class: 'hud-mc-media-artist'});
    mediaText.add_child(mediaTitle);
    mediaText.add_child(mediaArtist);
    const mediaBtns = new St.BoxLayout({style_class: 'hud-mc-media-btns'});
    let mediaPlayer = null;
    const mprisCall = method => {
        if (!mediaPlayer)
            return;
        Gio.DBus.session.call(mediaPlayer, '/org/mpris/MediaPlayer2', 'org.mpris.MediaPlayer2.Player',
            method, null, null, Gio.DBusCallFlags.NONE, -1, null, () => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
                refreshMedia();
                return GLib.SOURCE_REMOVE;
            }));
    };
    const playIcon = new St.Icon({icon_name: 'media-playback-start-symbolic', style_class: 'hud-mc-media-icon'});
    for (const [icon, method] of [['media-skip-backward-symbolic', 'Previous'], [null, 'PlayPause'], ['media-skip-forward-symbolic', 'Next']]) {
        const b = new St.Button({style_class: 'hud-mc-media-btn',
            child: icon ? new St.Icon({icon_name: icon, style_class: 'hud-mc-media-icon'}) : playIcon});
        b.connect('clicked', () => mprisCall(method));
        mediaBtns.add_child(b);
    }
    mediaBox.add_child(mediaText);
    mediaBox.add_child(mediaBtns);
    mediaSection.add_child(mediaBox);
    content.add_child(mediaSection);

    const refreshMedia = () => {
        Gio.DBus.session.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'ListNames',
            null, null, Gio.DBusCallFlags.NONE, -1, null, (conn, res) => {
                let names = [];
                try {
                    [names] = conn.call_finish(res).deepUnpack();
                } catch {}
                const players = names.filter(n => n.startsWith('org.mpris.MediaPlayer2.'));
                if (!players.length) {
                    mediaPlayer = null;
                    mediaSection.visible = false;
                    return;
                }
                let pending = players.length;
                const found = [];
                for (const name of players) {
                    conn.call(name, '/org/mpris/MediaPlayer2', 'org.freedesktop.DBus.Properties', 'GetAll',
                        new GLib.Variant('(s)', ['org.mpris.MediaPlayer2.Player']), null,
                        Gio.DBusCallFlags.NONE, 1000, null, (c2, r2) => {
                            try {
                                const [props] = c2.call_finish(r2).recursiveUnpack();
                                found.push({name, props});
                            } catch {}
                            if (--pending)
                                return;
                            const pick = found.find(p => p.props.PlaybackStatus === 'Playing') ??
                                found.find(p => p.props.PlaybackStatus === 'Paused');
                            if (!pick) {
                                mediaPlayer = null;
                                mediaSection.visible = false;
                                return;
                            }
                            mediaPlayer = pick.name;
                            const md = pick.props.Metadata ?? {};
                            mediaTitle.text = md['xesam:title'] || 'Unknown title';
                            const artist = md['xesam:artist'];
                            mediaArtist.text = (Array.isArray(artist) ? artist.join(', ') : artist) || pick.name.split('.').pop();
                            playIcon.icon_name = pick.props.PlaybackStatus === 'Playing'
                                ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
                            mediaSection.visible = true;
                        });
                }
            });
    };

    // ── status: readout strip (opens Quick Settings) + background apps ──
    const statusTitle = sectionTitle('STATUS');
    content.add_child(statusTitle);
    const qs = Main.panel.statusArea.quickSettings;
    const qsOrigSource = qs?.menu?.sourceActor;
    const openQuickSettings = src => {
        if (!qs?.menu)
            return;
        qs.menu.sourceActor = src;
        if (qs.menu._boxPointer)
            qs.menu._boxPointer._userArrowSide = St.Side.TOP;
        // the menu lives in uiGroup; lift it above the drawer layer
        Main.uiGroup.set_child_above_sibling(qs.menu.actor, null);
        qs.menu.toggle();
    };
    const strip = buildStatusStrip({onActivate: openQuickSettings});
    content.add_child(strip.actor);
    undo.push(() => {
        if (qs?.menu && qsOrigSource)
            qs.menu.sourceActor = qsOrigSource;
        strip.destroy();
    });

    // tray icons (Discord, Caffeine, battery limit, ...) keep their own menus
    // pinned to the drawer's bottom edge, outside the scrolling content
    const trayRow = new St.BoxLayout({style_class: 'hud-mc-tray'});
    trayRow.add_child(full(new St.Label({text: 'BACKGROUND', style_class: 'hud-mc-tray-k', x_expand: true, y_align: Clutter.ActorAlign.CENTER})));
    drawer.add_child(trayRow);
    const moved = [];          // {container, parent, index}
    let trayAlive = true;      // false once the drawer is being torn down
    const SKIP = new Set(['activities', 'dateMenu', 'hud-telemetry', 'a11y', 'quickSettings']);
    const panelBoxes = [Main.panel._leftBox, Main.panel._centerBox, Main.panel._rightBox];
    const adopt = () => {
        for (const role of Object.keys(Main.panel.statusArea)) {
            if (SKIP.has(role))
                continue;
            const button = Main.panel.statusArea[role];
            const container = button?.container;
            if (!container || moved.some(m => m.container === container))
                continue;
            const parent = container.get_parent();
            if (!panelBoxes.includes(parent))
                continue;
            moved.push({container, parent, index: parent.get_children().indexOf(container)});
            parent.remove_child(container);
            trayRow.add_child(container);
            // the owning extension may destroy its icon while it sits in the
            // drawer (e.g. it gets disabled); forget it then, or undo would
            // touch a disposed actor and crash the shell
            container.connect('destroy', () => {
                if (!trayAlive)
                    return;
                const k = moved.findIndex(x => x.container === container);
                if (k >= 0)
                    moved.splice(k, 1);
                syncTray();
            });
            if (button.menu?._boxPointer)
                button.menu._boxPointer._userArrowSide = St.Side.TOP;
        }
        syncTray();
    };
    // only show the row when at least one tray icon is actually visible
    function syncTray() {
        // an indicator may hide its button rather than its container
        const shown = m => m.container.visible && (m.container.get_first_child()?.visible ?? true);
        trayRow.visible = moved.some(shown);
        for (const m of moved) {
            if (!m.watching) {
                m.watching = true;
                m.container.connectObject('notify::visible', syncTray, opts.owner);
                m.container.get_first_child()?.connectObject('notify::visible', syncTray, opts.owner);
            }
        }
    }
    adopt();
    for (const b of panelBoxes)
        b.connectObject('child-added', () => GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            adopt();
            return GLib.SOURCE_REMOVE;
        }), opts.owner);
    undo.push(() => {
        for (const b of panelBoxes)
            b.disconnectObject(opts.owner);
        trayAlive = false;  // destroy handlers must not touch the row any more
        const alive = [...moved];
        moved.length = 0;
        for (const m of alive) {
            try {
                m.container.disconnectObject(opts.owner);
                m.container.get_first_child()?.disconnectObject(opts.owner);
            } catch {}
        }
        for (const m of alive.sort((x, y) => x.index - y.index)) {
            try {
                m.container.get_parent()?.remove_child(m.container);
                m.parent.insert_child_at_index(m.container, Math.min(m.index, m.parent.get_n_children()));
            } catch (e) {
                logError(e, 'hud-shell: could not return a tray icon to the panel');
            }
        }
    });

    // ── clipboard timeline ──
    const clip = buildClipboard({
        onCopied: () => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 220, () => {
            hide();
            return GLib.SOURCE_REMOVE;
        }),
    });
    content.add_child(clip.actor);
    undo.push(() => clip.destroy());

    // ── notifications: the bell opens GNOME's list over the drawer ──
    const notifPanel = new St.BoxLayout({vertical: true, style_class: 'hud-mc-notifpanel', visible: false, x_expand: true, y_expand: true});
    const npHead = new St.BoxLayout({style_class: 'hud-mc-np-head'});
    const backBtn = new St.Button({style_class: 'hud-mc-back', child: full(new St.Label({text: '‹  BACK'})), can_focus: true});
    npHead.add_child(backBtn);
    npHead.add_child(full(new St.Label({text: 'NOTIFICATIONS', style_class: 'hud-mc-section', x_expand: true, x_align: Clutter.ActorAlign.END, y_align: Clutter.ActorAlign.CENTER})));
    notifPanel.add_child(npHead);
    drawer.add_child(notifPanel);
    drawer.set_child_above_sibling(trayRow, null);   // keep the tray last (bottom)
    const msgList = Main.panel.statusArea.dateMenu?._messageList;
    if (msgList) {
        const origParent = msgList.get_parent();
        const origIndex = origParent.get_children().indexOf(msgList);
        origParent.remove_child(msgList);
        msgList.y_expand = true;
        notifPanel.add_child(msgList);
        undo.push(() => {
            notifPanel.remove_child(msgList);
            origParent.insert_child_at_index(msgList, origIndex);
        });
    }
    const showNotifs = on => {
        scroll.visible = !on;
        notifPanel.visible = on;
        if (on)
            backBtn.grab_key_focus();
    };
    bell.connect('clicked', () => showNotifs(!notifPanel.visible));
    backBtn.connect('clicked', () => showNotifs(false));
    const updateBell = () => {
        const n = Main.messageTray.getSources().reduce((sum, src) => sum + (src.notifications?.length ?? 0), 0);
        bellCount.text = n > 99 ? '99+' : String(n);
        bellCount.visible = n > 0;
        if (n)
            bell.add_style_class_name('hud-mc-bell-on');
        else
            bell.remove_style_class_name('hud-mc-bell-on');
    };

    // section order, top to bottom
    [headerRow, cal, statusTitle, strip.actor, mediaSection, clip.actor, appsTitle, appsBox]
        .forEach((actor, i) => content.set_child_at_index(actor, i));

    // ── open / close ──
    let grab = null;
    let open = false;
    let clockId = 0;

    const layoutFor = () => {
        const m = Main.layoutManager.primaryMonitor;
        layer.set_position(m.x, m.y);
        layer.set_size(m.width, m.height);
        backdrop.set_position(0, 0);
        backdrop.set_size(m.width, m.height);
        const w = Math.min(width, m.width);
        drawer.set_position(m.width - w, 0);
        drawer.set_size(w, m.height);
    };

    const show = () => {
        if (open)
            return;
        if (Main.overview.visible)
            Main.overview.hide();
        open = true;
        layoutFor();
        tickClock();
        calMonth = new Date();
        calMonth.setDate(1);
        renderCalendar();
        renderApps();
        refreshMedia();
        strip.refresh();
        clip.refresh();
        updateBell();
        showNotifs(false);
        clockId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            tickClock();
            if (GLib.DateTime.new_now_local().get_second() % 2 === 0) {
                refreshMedia();
                strip.refresh();
                updateBell();
            }
            return GLib.SOURCE_CONTINUE;
        });
        layer.show();
        grab = Main.pushModal(layer, {actionMode: Shell.ActionMode.POPUP});
        drawer.remove_all_transitions();
        backdrop.remove_all_transitions();
        drawer.translation_x = drawer.width;
        backdrop.opacity = 0;
        drawer.ease({translation_x: 0, duration: slideMs, mode: Clutter.AnimationMode.EASE_OUT_CUBIC});
        backdrop.ease({opacity: 255, duration: slideMs, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        // typing straight away filters the clipboard
        clip.focusSearch();
    };

    const hide = () => {
        if (!open)
            return;
        open = false;
        if (clockId) {
            GLib.source_remove(clockId);
            clockId = 0;
        }
        clip.hidden();
        // close any status menu opened from the drawer first
        Main.panel.menuManager.activeMenu?.close(false);
        if (grab) {
            Main.popModal(grab);
            grab = null;
        }
        backdrop.ease({opacity: 0, duration: slideMs, mode: Clutter.AnimationMode.EASE_IN_QUAD});
        drawer.ease({
            translation_x: drawer.width,
            duration: slideMs,
            mode: Clutter.AnimationMode.EASE_IN_CUBIC,
            onComplete: () => {
                if (!open)
                    layer.hide();
            },
        });
    };

    backdrop.connect('button-press-event', () => {
        hide();
        return Clutter.EVENT_STOP;
    });
    // at shell shutdown the UI is destroyed without disabling extensions;
    // stop the clock so it never touches dead widgets
    layer.connect('destroy', () => {
        open = false;
        if (clockId) {
            GLib.source_remove(clockId);
            clockId = 0;
        }
    });
    layer.connect('key-press-event', (_a, event) => {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
            hide();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    });
    Main.overview.connectObject('showing', hide, layer);

    // Super+S: take over the Quick Settings shortcut; give it back on undo
    const kb = new Gio.Settings({schema_id: 'org.gnome.shell.keybindings'});
    const Meta = opts.Meta;
    Main.wm.removeKeybinding('toggle-quick-settings');
    Main.wm.addKeybinding('toggle-quick-settings', kb, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
        () => (open ? hide() : show()));

    // Super+V / Super+M (GNOME's message-tray keys): open on the clipboard
    Main.wm.removeKeybinding('toggle-message-tray');
    Main.wm.addKeybinding('toggle-message-tray', kb, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
        () => {
            if (open) {
                hide();
                return;
            }
            show();
            scroll.vadjustment.value = Math.max(0, clip.actor.y - 12);
        });

    // headless testing only: HUD_MC_TEST=1 opens the drawer at startup
    if (GLib.getenv('HUD_MC_TEST') !== null) {
        let testId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 4, () => {
            testId = 0;
            show();
            return GLib.SOURCE_REMOVE;
        });
        undo.push(() => testId && GLib.source_remove(testId));
    }

    undo.push(() => {
        if (clockId)
            GLib.source_remove(clockId);
        if (grab)
            Main.popModal(grab);
        Main.wm.removeKeybinding('toggle-quick-settings');
        Main.wm.addKeybinding('toggle-quick-settings', kb, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
            Main.wm._toggleQuickSettings.bind(Main.wm));
        Main.wm.removeKeybinding('toggle-message-tray');
        Main.wm.addKeybinding('toggle-message-tray', kb, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
            Main.wm._toggleCalendar.bind(Main.wm));
        Main.overview.disconnectObject(layer);
    });

    // layer goes last so moved-in widgets are back home before it is destroyed
    return () => {
        while (undo.length) {
            try {
                undo.pop()();
            } catch (e) {
                logError(e, 'hud-shell control drawer: undo failed');
            }
        }
        Main.layoutManager.removeChrome(layer);
        layer.destroy();
    };
}
