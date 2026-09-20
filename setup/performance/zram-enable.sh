#!/usr/bin/env bash
# Enable zram (compressed RAM swap) on Ubuntu 26.04.
# Sized at 50% of RAM (~6.4G compressed, holds roughly 2-3x that in real pages).
# Written 2026-09-20. Run:  sudo bash setup/performance/zram-enable.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash setup/performance/zram-enable.sh"; exit 1; }

echo "==> Installing systemd-zram-generator"
apt-get update -qq
apt-get install -y systemd-zram-generator

echo "==> Writing /etc/systemd/zram-generator.conf"
cat > /etc/systemd/zram-generator.conf <<'CONF'
[zram0]
zram-size = ram / 2
compression-algorithm = zstd
swap-priority = 100
fs-type = swap
CONF

echo "==> Tuning vm settings for zram"
# With zram, swapping is cheap (RAM-speed), so swappiness should be HIGH.
# The old value of 10 was tuned for a slow disk swapfile.
cat > /etc/sysctl.d/99-zram.conf <<'CONF'
vm.swappiness = 180
vm.watermark_boost_factor = 0
vm.watermark_scale_factor = 125
vm.page-cluster = 0
CONF
sysctl --quiet -p /etc/sysctl.d/99-zram.conf

echo "==> (Re)starting zram so the config above is actually read"
# apt may have already started zram0 with defaults; stop it first or the
# config written above is silently ignored.
systemctl stop systemd-zram-setup@zram0.service 2>/dev/null || true
swapoff /dev/zram0 2>/dev/null || true
modprobe -r zram 2>/dev/null || true
systemctl daemon-reload
systemctl start systemd-zram-setup@zram0.service

echo
echo "==> Result:"
swapon --show
echo
echo "Note: the existing 4G /swap.img stays as a low-priority fallback (prio -1)."
echo "zram is priority 100, so the kernel fills zram first."
