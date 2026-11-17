// Status readout strip (Mission Control "S2"): NET · BT · VOL · BAT.
//
//   buildStatusStrip({onActivate}) -> {actor, refresh(), destroy()}
//
// Reads the same sources GNOME's Quick Settings uses: NetworkManager,
// GNOME Bluetooth, the shell's PulseAudio mixer and the kernel battery files.
// Clicking the strip calls onActivate (the drawer opens Quick Settings there).

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';
import 'gi://GnomeBluetooth?version=3.0';
import GnomeBluetooth from 'gi://GnomeBluetooth';
import NM from 'gi://NM';

import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';

const decoder = new TextDecoder();
const readText = path => {
    try {
        const [ok, bytes] = GLib.file_get_contents(path);
        return ok ? decoder.decode(bytes).trim() : null;
    } catch {
        return null;
    }
};

const noEllipsize = l => {
    l.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    return l;
};

function makeCell(key) {
    const box = new St.BoxLayout({vertical: true, style_class: 'hud-ss-cell', x_expand: true});
    const k = noEllipsize(new St.Label({text: key, style_class: 'hud-ss-k'}));
    const v = new St.Label({text: '--', style_class: 'hud-ss-v'});
    const subRow = new St.BoxLayout({style_class: 'hud-ss-subrow'});
    const bars = new St.BoxLayout({style_class: 'hud-ss-bars', visible: false, y_align: Clutter.ActorAlign.END});
    const barW = [];
    for (let i = 0; i < 4; i++) {
        const b = new St.Widget({style_class: 'hud-ss-bar', y_align: Clutter.ActorAlign.END, height: 3 + i * 2});
        bars.add_child(b);
        barW.push(b);
    }
    const sub = new St.Label({text: '', style_class: 'hud-ss-sub'});
    subRow.add_child(bars);
    subRow.add_child(sub);
    box.add_child(k);
    box.add_child(v);
    box.add_child(subRow);
    return {
        box,
        set(value, subText, level = null) {
            v.text = value;
            sub.text = subText ?? '';
            for (const c of ['hud-ss-warn', 'hud-ss-crit', 'hud-ss-off'])
                v.remove_style_class_name(c);
            if (level)
                v.add_style_class_name(level);
        },
        signal(strength) {   // 0..100, or null to hide the bars
            bars.visible = strength !== null;
            const lit = strength === null ? 0 : Math.max(1, Math.ceil(strength / 25));
            barW.forEach((b, i) => {
                if (i < lit)
                    b.remove_style_class_name('hud-ss-bar-off');
                else
                    b.add_style_class_name('hud-ss-bar-off');
            });
        },
    };
}

export function buildStatusStrip({onActivate}) {
    const strip = new St.Button({style_class: 'hud-ss', x_expand: true, can_focus: true, track_hover: true});
    const row = new St.BoxLayout({x_expand: true});
    strip.set_child(row);
    const net = makeCell('NET');
    const bt = makeCell('BT');
    const vol = makeCell('VOL');
    const bat = makeCell('BAT');
    [net, bt, vol, bat].forEach((c, i) => {
        if (i)
            row.add_child(new St.Widget({style_class: 'hud-ss-div'}));
        row.add_child(c.box);
    });
    strip.connect('clicked', () => onActivate(strip));

    // ── sources ──
    let nm = null;
    NM.Client.new_async(null, (_o, res) => {
        try {
            nm = NM.Client.new_finish(res);
            refresh();
        } catch (e) {
            logError(e, 'hud-shell status: NetworkManager');
        }
    });
    const btClient = new GnomeBluetooth.Client();
    const mixer = Volume.getMixerControl();

    const refreshNet = () => {
        if (!nm) {
            net.set('…', '');
            net.signal(null);
            return;
        }
        if (!nm.networking_enabled || !nm.wireless_enabled && !nm.get_primary_connection()) {
            net.set('OFF', 'airplane / disabled', 'hud-ss-off');
            net.signal(null);
            return;
        }
        const conn = nm.get_primary_connection();
        if (!conn) {
            net.set('OFFLINE', nm.wireless_enabled ? 'not connected' : 'Wi-Fi off', 'hud-ss-off');
            net.signal(null);
            return;
        }
        const dev = conn.get_devices()?.[0];
        if (dev instanceof NM.DeviceWifi) {
            const ap = dev.get_active_access_point();
            const mhz = ap?.get_frequency() ?? 0;
            net.set(conn.get_id(), mhz > 5900 ? '6 GHz' : mhz > 4900 ? '5 GHz' : mhz ? '2.4 GHz' : 'Wi-Fi');
            net.signal(ap ? ap.get_strength() : null);
        } else {
            net.set(dev instanceof NM.DeviceEthernet ? 'Wired' : conn.get_id(), conn.get_connection_type?.() ?? '');
            net.signal(null);
        }
    };

    const refreshBt = () => {
        if (btClient.default_adapter_state !== GnomeBluetooth.AdapterState.ON) {
            bt.set('OFF', '', 'hud-ss-off');
            return;
        }
        const store = btClient.get_devices();
        const connected = [];
        for (let i = 0; i < store.get_n_items(); i++) {
            const d = store.get_item(i);
            if (d.connected)
                connected.push(d);
        }
        if (!connected.length) {
            bt.set('ON', 'no device');
            return;
        }
        const d = connected[0];
        const name = (d.alias || d.name || 'Device').replace(/^CMF\s+/, '');
        const pct = d.battery_percentage > 0 ? `${Math.round(d.battery_percentage)}%` : '';
        bt.set(name, [pct, connected.length > 1 ? `+${connected.length - 1}` : ''].filter(Boolean).join(' · ') || 'connected');
    };

    const refreshVol = () => {
        const sink = mixer.get_default_sink();
        if (!sink) {
            vol.set('--', '');
            return;
        }
        const pct = Math.round(100 * sink.volume / mixer.get_vol_max_norm());
        const out = sink.get_port()?.human_port || sink.description || '';
        if (sink.is_muted)
            vol.set('MUTE', out, 'hud-ss-off');
        else
            vol.set(`${pct}%`, out, pct > 100 ? 'hud-ss-warn' : null);
    };

    const refreshBat = () => {
        const base = '/sys/class/power_supply/BAT0';
        const cap = parseInt(readText(`${base}/capacity`) ?? '', 10);
        if (!Number.isFinite(cap)) {
            bat.set('AC', '');
            return;
        }
        const status = readText(`${base}/status`) ?? '';
        const energy = Number(readText(`${base}/energy_now`) ?? readText(`${base}/charge_now`) ?? 0);
        const full = Number(readText(`${base}/energy_full`) ?? readText(`${base}/charge_full`) ?? 0);
        const power = Math.abs(Number(readText(`${base}/power_now`) ?? readText(`${base}/current_now`) ?? 0));
        let sub = status.toLowerCase();
        const hm = h => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;
        if (power > 0 && status === 'Discharging')
            sub = hm(energy / power);
        else if (power > 0 && status === 'Charging' && full > energy)
            sub = `${hm((full - energy) / power)} to full`;
        else if (status === 'Not charging')
            sub = 'held (limit)';
        bat.set(`${cap}%`, sub, status === 'Discharging' && cap <= 10 ? 'hud-ss-crit'
            : status === 'Discharging' && cap <= 20 ? 'hud-ss-warn' : null);
    };

    const refresh = () => {
        for (const f of [refreshNet, refreshBt, refreshVol, refreshBat]) {
            try {
                f();
            } catch (e) {
                logError(e, 'hud-shell status strip');
            }
        }
    };

    return {
        actor: strip,
        refresh,
        destroy() {
            strip.destroy();
        },
    };
}
