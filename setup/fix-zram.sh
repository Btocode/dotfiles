#!/usr/bin/env bash
# Re-apply the zram config that setup-zram.sh wrote too late to take effect.
# The apt install auto-started zram0 with Ubuntu's defaults (4G, lzo-rle);
# this tears that down and recreates it from /etc/systemd/zram-generator.conf.
# Run:  sudo bash ~/fix-zram.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash ~/fix-zram.sh"; exit 1; }

DATA_KB=$(( $(zramctl --noheadings --bytes --output DATA /dev/zram0 2>/dev/null || echo 0) / 1024 ))
AVAIL_KB=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
echo "==> zram currently holds ${DATA_KB}K; ${AVAIL_KB}K available to absorb it"
if (( DATA_KB + 262144 > AVAIL_KB )); then
  echo "!! Not enough free memory to safely swapoff zram right now."
  echo "   Close some apps (Chrome/VS Code) and re-run."
  exit 1
fi

echo "==> Current (wrong) state:"
zramctl --output NAME,ALGORITHM,DISKSIZE

echo "==> Stopping zram0 (migrates its pages back to RAM)"
systemctl stop systemd-zram-setup@zram0.service
# The generator creates a .swap unit; make sure the device is really gone
swapoff /dev/zram0 2>/dev/null || true
modprobe -r zram 2>/dev/null || true

echo "==> Re-running generators so /etc/systemd/zram-generator.conf is picked up"
systemctl daemon-reload

echo "==> Starting zram0 with the intended config"
systemctl start systemd-zram-setup@zram0.service
sleep 1

echo
echo "==> Result (expect ~6.4G and zstd):"
zramctl --output NAME,ALGORITHM,DISKSIZE,DATA,COMPR
echo
swapon --show
