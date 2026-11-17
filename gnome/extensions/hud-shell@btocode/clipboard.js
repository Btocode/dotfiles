// Clipboard timeline (Mission Control "C1").
//
//   buildClipboard({onCopied}) -> {actor, refresh(), focusSearch(), destroy()}
//
// Tracks the clipboard itself (Meta.Selection), newest first, with a type
// badge per entry (CMD / URL / CODE / colour swatch / IMG / TXT), search,
// copy and pin. History lives in memory only; pinned entries (text) are saved
// to ~/.local/share/hud-shell/clipboard-pins.json. Anything a password
// manager marks as secret (x-kde-passwordManagerHint) is never recorded.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

const MAX_HISTORY = 60;
const MAX_SHOWN = 14;
const PINS = GLib.build_filenamev([GLib.get_user_data_dir(), 'hud-shell', 'clipboard-pins.json']);
const CB = St.ClipboardType.CLIPBOARD;

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function classify(text) {
    const t = text.trim();
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t) || /^(rgb|hsl|oklch)a?\(/i.test(t))
        return 'color';
    if (/^(https?:\/\/|www\.)\S+$/i.test(t))
        return 'url';
    const lines = t.split('\n');
    if (lines.length === 1 && /^(\$ |sudo |git |npm |pnpm |yarn |npx |docker |kubectl |ssh |scp |cd |ls |cat |grep |curl |wget |make |cargo |python3? |pip |apt |systemctl |journalctl |gsettings |dconf |hud-theme |claude )/.test(t))
        return 'cmd';
    if (lines.length > 1 && /[{};=()<>]|^\s{2,}\S/m.test(t))
        return 'code';
    if (/^(const|let|var|function|import|export|def|class|SELECT|return)\b/.test(t) || /=>|;\s*$/.test(t))
        return 'code';
    return 'text';
}

const BADGE = {cmd: 'CMD', url: 'URL', code: 'CODE', text: 'TXT', img: 'IMG', color: 'CLR'};

function ago(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 45)
        return 'now';
    if (s < 3600)
        return `${Math.round(s / 60)}m`;
    if (s < 86400)
        return `${Math.round(s / 3600)}h`;
    return `${Math.round(s / 86400)}d`;
}

export function buildClipboard({onCopied}) {
    const clipboard = St.Clipboard.get_default();
    const selection = global.display.get_selection();
    let history = [];      // {kind, text?, bytes?, mime?, label, t, pinned}
    let suppress = null;   // text we just put on the clipboard ourselves

    // ── pins on disk ──
    const loadPins = () => {
        try {
            const [ok, b] = GLib.file_get_contents(PINS);
            if (ok)
                return JSON.parse(decoder.decode(b)).map(p => ({...p, pinned: true, kind: classify(p.text), label: p.text}));
        } catch {}
        return [];
    };
    const savePins = () => {
        try {
            GLib.mkdir_with_parents(GLib.path_get_dirname(PINS), 0o700);
            const pins = history.filter(h => h.pinned && h.text).map(h => ({text: h.text, t: h.t}));
            GLib.file_set_contents(PINS, encoder.encode(JSON.stringify(pins)));
            GLib.chmod(PINS, 0o600);
        } catch (e) {
            logError(e, 'hud-shell clipboard: saving pins');
        }
    };
    history = loadPins();

    // ── tracking ──
    const addText = text => {
        if (!text || !text.trim() || text === suppress)
            return;
        const existing = history.find(h => h.text === text);
        if (existing) {
            existing.t = Date.now();
        } else {
            history.unshift({kind: classify(text), text, label: text, t: Date.now(), pinned: false});
        }
        history.sort((a, b) => (b.pinned - a.pinned) || (b.t - a.t));
        // trim unpinned history
        let unpinned = 0;
        history = history.filter(h => h.pinned || ++unpinned <= MAX_HISTORY);
        if (visible)
            render();
    };
    const addImage = (bytes, mime) => {
        const size = bytes.get_size();
        history.unshift({kind: 'img', bytes, mime, label: `Image · ${mime.replace('image/', '').toUpperCase()} · ${Math.round(size / 1024)} KB`, t: Date.now(), pinned: false});
        let unpinned = 0;
        history = history.filter(h => h.pinned || ++unpinned <= MAX_HISTORY);
        if (visible)
            render();
    };

    const ownerId = selection.connect('owner-changed', (sel, type, source) => {
        if (type !== Meta.SelectionType.SELECTION_CLIPBOARD || !source)
            return;
        const mimes = sel.get_mimetypes(Meta.SelectionType.SELECTION_CLIPBOARD);
        if (mimes.some(m => m.includes('passwordManagerHint') || m === 'x-kde-passwordManagerHint'))
            return;
        if (mimes.some(m => m.startsWith('text/plain') || m === 'UTF8_STRING' || m === 'STRING')) {
            clipboard.get_text(CB, (_c, text) => addText(text));
            return;
        }
        const img = mimes.find(m => m === 'image/png') ?? mimes.find(m => m.startsWith('image/'));
        if (img) {
            clipboard.get_content(CB, img, (_c, bytes) => {
                if (bytes && bytes.get_size() > 0)
                    addImage(bytes, img);
            });
        }
    });

    // ── UI ──
    const actor = new St.BoxLayout({vertical: true, style_class: 'hud-cb'});
    const head = new St.BoxLayout({style_class: 'hud-cb-head'});
    const title = new St.Label({text: 'CLIPBOARD', style_class: 'hud-mc-section', x_expand: true});
    const meta = new St.Label({style_class: 'hud-cb-meta', y_align: Clutter.ActorAlign.END});
    head.add_child(title);
    head.add_child(meta);
    actor.add_child(head);

    const search = new St.Entry({style_class: 'hud-cb-search', hint_text: 'Search clipboard…', can_focus: true, x_expand: true});
    search.set_primary_icon(new St.Icon({icon_name: 'edit-find-symbolic', style_class: 'hud-cb-search-icon'}));
    actor.add_child(search);
    const list = new St.BoxLayout({vertical: true, style_class: 'hud-cb-list'});
    actor.add_child(list);

    let visible = false;
    let sel = 0;
    let rows = [];

    const copy = entry => {
        if (entry.kind === 'img') {
            clipboard.set_content(CB, entry.mime, entry.bytes);
        } else {
            suppress = entry.text;
            clipboard.set_text(CB, entry.text);
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                suppress = null;
                return GLib.SOURCE_REMOVE;
            });
        }
        entry.t = Date.now();
        onCopied?.(entry);
    };

    const togglePin = entry => {
        if (entry.kind === 'img')
            return;
        entry.pinned = !entry.pinned;
        history.sort((a, b) => (b.pinned - a.pinned) || (b.t - a.t));
        savePins();
        render();
    };

    const select = i => {
        if (!rows.length)
            return;
        sel = Math.max(0, Math.min(rows.length - 1, i));
        rows.forEach((r, k) => (k === sel ? r.btn.add_style_class_name('hud-cb-sel') : r.btn.remove_style_class_name('hud-cb-sel')));
    };

    const render = () => {
        list.destroy_all_children();
        rows = [];
        const q = search.get_text().trim().toLowerCase();
        const items = history.filter(h => !q || (h.text ?? h.label).toLowerCase().includes(q));
        const pinnedCount = history.filter(h => h.pinned).length;
        meta.text = `${history.length} items${pinnedCount ? ` · ${pinnedCount} pinned` : ''}`;
        if (!items.length) {
            list.add_child(new St.Label({
                text: q ? 'No match' : 'Copy something; it shows up here',
                style_class: 'hud-cb-empty',
            }));
            return;
        }
        for (const entry of items.slice(0, MAX_SHOWN)) {
            const row = new St.BoxLayout({style_class: 'hud-cb-row-box', x_expand: true});
            if (entry.pinned) {
                row.add_child(new St.Label({text: '★', style_class: 'hud-cb-pin', y_align: Clutter.ActorAlign.CENTER}));
            } else if (entry.kind === 'color' && entry.text.trim().startsWith('#')) {
                const sw = new St.Widget({style_class: 'hud-cb-swatch', y_align: Clutter.ActorAlign.CENTER});
                sw.set_style(`background-color: ${entry.text.trim()};`);
                row.add_child(sw);
            } else {
                row.add_child(new St.Label({
                    text: BADGE[entry.kind], y_align: Clutter.ActorAlign.CENTER,
                    style_class: `hud-cb-badge hud-cb-${entry.kind}`,
                }));
            }
            const oneLine = entry.label.replace(/\s+/g, ' ').trim();
            row.add_child(new St.Label({text: oneLine, style_class: 'hud-cb-text', x_expand: true, y_align: Clutter.ActorAlign.CENTER}));

            const time = new St.Label({text: entry.pinned ? 'pinned' : ago(entry.t), style_class: 'hud-cb-time', y_align: Clutter.ActorAlign.CENTER});
            const acts = new St.BoxLayout({style_class: 'hud-cb-acts', visible: false, y_align: Clutter.ActorAlign.CENTER});
            const copyBtn = new St.Button({label: 'COPY', style_class: 'hud-cb-act'});
            copyBtn.connect('clicked', () => copy(entry));
            acts.add_child(copyBtn);
            if (entry.kind !== 'img') {
                const pinBtn = new St.Button({label: entry.pinned ? 'UNPIN' : 'PIN', style_class: 'hud-cb-act'});
                pinBtn.connect('clicked', () => togglePin(entry));
                acts.add_child(pinBtn);
            }
            row.add_child(time);
            row.add_child(acts);

            const btn = new St.Button({style_class: 'hud-cb-row', child: row, x_expand: true, track_hover: true});
            btn.connect('clicked', () => copy(entry));
            const idx = rows.length;
            btn.connect('notify::hover', () => {
                acts.visible = btn.hover;
                time.visible = !btn.hover;
                if (btn.hover)
                    select(idx);
            });
            list.add_child(btn);
            rows.push({btn, entry});
        }
        select(0);
    };

    search.clutter_text.connect('text-changed', render);
    search.clutter_text.connect('key-press-event', (_a, event) => {
        const key = event.get_key_symbol();
        if (key === Clutter.KEY_Down) {
            select(sel + 1);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Up) {
            select(sel - 1);
            return Clutter.EVENT_STOP;
        }
        if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
            if (rows[sel])
                copy(rows[sel].entry);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    });

    return {
        actor,
        refresh() {
            visible = true;
            search.set_text('');
            render();
        },
        hidden() {
            visible = false;
        },
        focusSearch() {
            search.grab_key_focus();
        },
        destroy() {
            selection.disconnect(ownerId);
            actor.destroy();
        },
    };
}
