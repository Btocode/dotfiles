// HUD Shell — the GNOME Shell tweaks this desktop actually uses (replaced
// Just Perfection). No preferences: edit FEATURES below and re-login.
//
//   hideDash           no dash in the overview
//   hideQsToggles      no Airplane Mode / Dark Style tiles in Quick Settings
//   startOnDesktop     log in to the desktop, not the overview
//   focusOnAttention   a window asking for attention is focused directly
//                      (instead of a "… is ready" notification)
//   noWorkspacesInGrid no workspace strip above the app grid
//   appGrid            denser app grid (GRID_COLS x GRID_ROWS), kept A–Z
//   controlDrawer      no panel at all; Super+S slides Mission Control in
//                      from the right (controlDrawer.js), Super+V opens it on
//                      the clipboard
//   appDrawer          Super+A slides a command palette in from the left
//                      (launcher.js): apps, Settings pages, open windows,
//                      actions and a calculator from one search box

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';
import * as WindowPreview from 'resource:///org/gnome/shell/ui/windowPreview.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {enableControlDrawer} from './controlDrawer.js';
import {enableLauncher} from './launcher.js';

const FEATURES = {
    hideDash: true,
    hideQsToggles: true,
    startOnDesktop: true,
    focusOnAttention: true,
    noWorkspacesInGrid: true,
    appGrid: true,
    appDrawer: true,
    controlDrawer: true,
};

// app grid
const GRID_COLS = 8;
const GRID_ROWS = 4;
const GRID_ICON = 64;

// Mission Control (right drawer, Super+S)
const MC_WIDTH = 460;
const MC_SLIDE_MS = 260;
const MC_TILE_ICON = 32;

// command palette (left drawer, Super+A)
const DRAWER_WIDTH = 420;
const DRAWER_ICON = 32;
const DRAWER_SLIDE_MS = 240;

const CLASS_NO_WS_GRID = 'hud-shell-no-workspaces-in-app-grid';

export default class HudShellExtension extends Extension {
    enable() {
        this._undo = [];
        const f = FEATURES;
        if (f.hideDash) this._hideDash();
        if (f.hideQsToggles) this._hideQsToggles();
        if (f.startOnDesktop) this._startOnDesktop();
        if (f.focusOnAttention) this._focusOnAttention();
        if (f.noWorkspacesInGrid) this._noWorkspacesInGrid();
        if (f.appGrid) this._appGrid();
        if (f.appDrawer) this._appDrawer();
        if (f.controlDrawer) this._controlDrawer();
    }

    disable() {
        // undo in reverse order of application
        while (this._undo.length) {
            try {
                this._undo.pop()();
            } catch (e) {
                logError(e, 'hud-shell: undo failed');
            }
        }
        this._undo = null;
    }

    // ── overview dash ──────────────────────────────────────────────────────

    _hideDash() {
        const dash = Main.overview.dash;
        if (!dash)
            return;
        dash.hide();
        dash.height = 0;

        // window captions would otherwise overlap where the dash used to be
        const wpp = WindowPreview.WindowPreview.prototype;
        const origOverlap = wpp.overlapHeights;
        wpp.overlapHeights = function () {
            const [top, bottom] = origOverlap.call(this);
            return [top + 24, bottom + 24];
        };

        this._undo.push(() => {
            wpp.overlapHeights = origOverlap;
            dash.show();
            dash.height = -1;
            dash.setMaxSize(-1, -1);
        });
    }

    // ── Quick Settings toggles ─────────────────────────────────────────────

    _hideQsToggles() {
        const qs = Main.panel.statusArea.quickSettings;
        const pending = new Set(['_rfkill', '_darkMode']);
        const undoFns = [];

        const tryApply = () => {
            if (pending.has('_rfkill') && qs._rfkill) {
                pending.delete('_rfkill');
                const t = qs._rfkill._rfkillToggle;
                const wasVisible = t.visible;
                t.hide();
                // rfkill shows the tile whenever hardware state changes
                t.connectObject('notify::visible', () => {
                    if (t.visible)
                        t.hide();
                }, this);
                undoFns.push(() => {
                    t.disconnectObject(this);
                    t.visible = wasVisible;
                });
            }
            if (pending.has('_darkMode') && qs._darkMode) {
                pending.delete('_darkMode');
                const t = qs._darkMode.quickSettingsItems[0];
                t.hide();
                undoFns.push(() => t.show());
            }
            if (pending.size === 0)
                qs._indicators.disconnectObject(this);
        };

        // indicators are created asynchronously at startup
        qs._indicators.connectObject('child-added', tryApply, this);
        tryApply();

        this._undo.push(() => {
            qs._indicators.disconnectObject(this);
            undoFns.forEach(fn => fn());
        });
    }

    // ── start on desktop ───────────────────────────────────────────────────

    _startOnDesktop() {
        const lm = Main.layoutManager;
        if (!lm._startingUp)
            return; // only meaningful during shell startup
        const sm = Main.sessionMode;
        const origHasOverview = sm.hasOverview;
        sm.hasOverview = false;
        lm.startInOverview = false;
        Main.overview._overview.controls._stateAdjustment.value =
            OverviewControls.ControlsState.HIDDEN;

        const restore = () => {
            sm.hasOverview = origHasOverview;
            lm.disconnectObject(this);
        };
        lm.connectObject('startup-complete', restore, this);
        this._undo.push(restore);
    }

    // ── focus windows that demand attention ────────────────────────────────

    _focusOnAttention() {
        const wah = Main.windowAttentionHandler;
        const display = global.display;
        // the shell's handler is connected with connectObject(…, wah)
        display.disconnectObject(wah);

        const focus = (_display, window) => {
            if (!window || window.has_focus() || window.is_skip_taskbar())
                return;
            Main.activateWindow(window);
        };
        // separate owner object so disconnectObject doesn't clash with others
        this._attnOwner = {};
        display.connectObject(
            'window-demands-attention', focus,
            'window-marked-urgent', focus,
            this._attnOwner);

        this._undo.push(() => {
            display.disconnectObject(this._attnOwner);
            this._attnOwner = null;
            display.connectObject(
                'window-demands-attention', wah._onWindowDemandsAttention.bind(wah),
                'window-marked-urgent', wah._onWindowDemandsAttention.bind(wah),
                wah);
        });
    }

    // ── no workspace strip in the app grid ─────────────────────────────────

    _noWorkspacesInGrid() {
        const layout = Main.overview._overview._controls.layout_manager;
        const orig = layout._computeWorkspacesBoxForState;
        const APP_GRID = OverviewControls.ControlsState.APP_GRID;

        layout._computeWorkspacesBoxForState = function (state, ...args) {
            const box = orig.call(this, state, ...args);
            if (state === APP_GRID)
                box.set_size(box.get_width(), 0);
            return box;
        };

        // the zero-height workspace still casts a shadow; hide it in the grid
        const uiGroup = Main.layoutManager.uiGroup;
        const btn = Main.overview.dash.showAppsButton;
        const sync = () => {
            if (btn.checked)
                uiGroup.add_style_class_name(CLASS_NO_WS_GRID);
            else
                uiGroup.remove_style_class_name(CLASS_NO_WS_GRID);
        };
        btn.connectObject('notify::checked', sync, this);
        sync();

        this._undo.push(() => {
            btn.disconnectObject(this);
            uiGroup.remove_style_class_name(CLASS_NO_WS_GRID);
            delete layout._computeWorkspacesBoxForState; // back to prototype
            if (layout._computeWorkspacesBoxForState !== orig)
                layout._computeWorkspacesBoxForState = orig;
        });
    }

    // ── denser, alphabetical app grid ──────────────────────────────────────

    _appGrid() {
        const appDisplay = Main.overview._overview._controls._appDisplay;
        const grid = appDisplay?._grid;
        const layout = grid?.layout_manager;
        if (!layout)
            return;

        const saved = {cols: layout._fixedCols, rows: layout._fixedRows, icon: layout.fixed_icon_size};
        const relayout = () => {
            // adaptToSize() returns early unless the page size "changed"
            layout._pageWidth = 0;
            layout._pageHeight = 0;
            grid.queue_relayout();
        };

        layout._fixedCols = GRID_COLS;
        layout._fixedRows = GRID_ROWS;
        layout.fixed_icon_size = GRID_ICON;
        relayout();

        // A–Z: an empty saved layout makes GNOME sort alphabetically. Clearing
        // it at every login keeps the grid A–Z even after installs or drags.
        global.settings.reset('app-picker-layout');

        this._undo.push(() => {
            layout._fixedCols = saved.cols;
            layout._fixedRows = saved.rows;
            layout.fixed_icon_size = saved.icon;
            relayout();
        });
    }

    // ── control drawer (Super+S, replaces the panel) ───────────────────────

    _controlDrawer() {
        const box = Main.layoutManager.panelBox;
        const setStruts = on => {
            const lm = Main.layoutManager;
            const i = lm._findActor?.(box) ?? -1;
            if (i < 0)
                return;
            const data = lm._trackedActors[i];
            if (data.affectsStruts !== on) {
                data.affectsStruts = on;
                lm._queueUpdateRegions();
            }
        };
        this._undo.push(enableControlDrawer({
            width: MC_WIDTH,
            slideMs: MC_SLIDE_MS,
            tileIcon: MC_TILE_ICON,
            setStruts,
            owner: {},
            Meta,
        }));
    }

    // ── command palette (Super+A, left drawer) ─────────────────────────────

    _appDrawer() {
        this._undo.push(enableLauncher({
            width: DRAWER_WIDTH,
            iconSize: DRAWER_ICON,
            slideMs: DRAWER_SLIDE_MS,
            themeCmd: GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'hud-theme']),
            Meta,
        }));
    }
}
