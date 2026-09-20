# Performance notes

## The memory situation

This is a 16 GB machine that reports **12.8 GiB usable** — the Radeon 680M takes a 2 GB UMA
carve-out. With Chrome, VS Code and a dev server running, available memory sits around 4 GiB.

If your BIOS exposes *UMA Frame Buffer Size*, dropping it to 512 MB reclaims most of that
2 GB; `amdgpu` allocates what it actually needs from GTT dynamically. Many IdeaPad BIOSes
don't expose the option at all.

## zram

zram is compressed swap that lives in RAM. Instead of writing cold pages to the NVMe, the
kernel compresses them with zstd and keeps them in memory — microseconds instead of
milliseconds, and no SSD write wear.

`system/etc/systemd/zram-generator.conf` sizes it at half of RAM (~6.4 GB) with zstd at
swap priority 100. The on-disk `/swap.img` stays at priority -1 as an OOM backstop, so the
kernel fills zram first and only falls back to disk under real pressure.

Measured on this machine: **841 MB of pages held in 255 MB of RAM — 3.4:1**. At that ratio
a 6.4 GB zram device absorbs roughly 21 GB of pages.

```bash
zramctl                      # DATA = pages held, COMPR = RAM actually used
swapon --show                # zram should be PRIO 100, swapfile -1
```

### swappiness=180 is not a typo

`vm.swappiness` defaults to 60, and tuning guides written for spinning disks tell you to
*lower* it. That advice assumes swapping is expensive. With zram it costs a memcpy and some
CPU, so the kernel should prefer it over evicting page cache. 180 is the value the
systemd-zram-generator maintainers recommend, and the rest of `99-zram.conf` follows:

| Setting | Why |
|---|---|
| `vm.page-cluster = 0` | Don't read ahead. Batching only helps on rotational media. |
| `vm.watermark_boost_factor = 0` | Disable boosted reclaim; pointless without slow swap. |
| `vm.watermark_scale_factor = 125` | Start reclaiming earlier, in smaller increments. |

### Installation gotcha

`apt install systemd-zram-generator` **starts zram0 immediately using package defaults**
(4 GB, `lzo-rle`). If you write your config afterwards and then run `systemctl start`, the
service is already active, the start is a silent no-op, and your config is never read —
you get defaults while believing otherwise.

Confirm with `zramctl`: the algorithm column should say `zstd`, not `lzo-rle`.

`install-system.sh` handles this by stopping the service, `swapoff`ing the device and
unloading the module before starting it again.

### Draining a pre-existing swapfile

Pages already stranded in `/swap.img` from before zram existed stay on disk until touched.
To pull them back at RAM speed — check you have the headroom first, since they decompress
into memory:

```bash
sudo swapoff /swap.img && sudo swapon /swap.img --priority -1
```

`setup/drain-swapfile.sh` does this with a safety check against `MemAvailable` plus free zram.

## Boot

Roughly 19 s total, ~9.6 s of it userspace. The main avoidable cost is
`NetworkManager-wait-online.service` (~3.7 s), which blocks `network-online.target` for a
laptop that doesn't need anything to wait on the network:

```bash
sudo systemctl disable NetworkManager-wait-online.service
```

## Power

`amd-pstate-epp` with the `powersave` governor and `balance_power` EPP is the correct modern
AMD setup, and `power-profiles-daemon` is already managing it.

**Don't install TLP.** It fights power-profiles-daemon, and on amd-pstate hardware it mostly
duplicates what the driver already does. There is nothing to fix here.
