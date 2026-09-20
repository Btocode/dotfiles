# Hardware notes — IdeaPad Slim 3 15ARP10 (83K7)

Everything here is specific to this model. Verify against your own machine first:

```bash
sudo dmidecode -s system-product-name   # expect: 83K7
```

## Keyboard dead after suspend

**Symptom.** Resume from s2idle and the internal keyboard is unresponsive. USB keyboards
work. A reboot fixes it until the next suspend.

**Cause.** An EC firmware bug on this chassis. The kernel's `amd_pmc` driver resumes the
power management controller faster than the EC can follow.

**Fix.** A DKMS build of `amd_pmc` carrying a `delay_suspend` parameter, from
[DanielGibson/amd_pmc-ideapad](https://github.com/DanielGibson/amd_pmc-ideapad) (@783d5d9,
built as `amd_pmc/0.0.4`, `delay_suspend=-1` for auto-detect).

**Why it uninstalls itself.** The same fix was merged upstream and ships in kernels 7.1.5
and 7.2. Leaving an out-of-tree module shadowing a fixed in-tree driver is how you get
mysterious breakage six months later. So `system/usr/local/sbin/amd-pmc-fix-check` runs
from `/etc/kernel/postinst.d` and `postrm.d` on every kernel change and:

1. For each installed kernel, finds Ubuntu's own `amd-pmc.ko` — including the copy DKMS
   moved aside into `/var/lib/dkms/amd_pmc/original_module/` — and checks with `modinfo`
   whether it has a `delay_suspend` parameter.
2. Removes the DKMS module for any kernel that no longer needs it.
3. Once *every* installed kernel ships the fix, removes the DKMS package entirely and
   deletes `/usr/src/amd_pmc-0.0.4`.

It never fails a kernel install, logs to syslog, and appends a line to
`/var/lib/amd-pmc-fix/events.log`. `bin/amd-pmc-fix-notify` turns new events into a desktop
notification at login, once each.

Check what it would do without changing anything:

```bash
/usr/local/sbin/amd-pmc-fix-check --dry-run
```

**Secure Boot.** Must stay **disabled** while the DKMS module is in use — an unsigned
out-of-tree module won't load otherwise, and MOK enrolment is more hassle than this
temporary workaround deserves.

## Battery charge limit

The EC exposes `conservation_mode`, which caps charging at roughly 60% — good for a laptop
that lives on mains power.

```bash
battery-limit status     # on (charge capped at ~60%) | off (charges to 100%)
battery-limit toggle     # or: on | off
```

Two things worth knowing:

- **GNOME's own battery-limit switch will never appear.** Settings looks for
  `charge_control_end_threshold`; `ideapad_laptop` only exposes `conservation_mode`.
  That's why this script exists.
- **The setting lives in the embedded controller**, not in software. It survives reboots,
  kernel changes and OS reinstalls. Set it once and forget it — including remembering to
  turn it *off* before you travel.

The udev rule (`system/etc/udev/rules.d/99-ideapad-conservation.rules`) chgrps the sysfs
attribute to your user at bind time, so no sudo and no daemon. `install-system.sh`
substitutes your username automatically.

## Firmware

Lenovo does not publish IdeaPad Slim 3 BIOS updates to LVFS, so `fwupdmgr` will never offer
one. Check [support.lenovo.com](https://support.lenovo.com) (ds573329) manually.
BIOS QBCN27WW (2025-09-30) was current as of 2026-09.
