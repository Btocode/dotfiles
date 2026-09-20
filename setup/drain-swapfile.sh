#!/usr/bin/env bash
# Drain the pages stranded in /swap.img from before zram existed.
# swapoff forces them back into RAM (and on into zstd zram if needed);
# swapon re-arms the file as a low-priority fallback.
# Run:  sudo bash ~/drain-swapfile.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash ~/drain-swapfile.sh"; exit 1; }

used_kb() { awk '/^\/swap.img/{print $4}' /proc/swaps; }
USED=$(used_kb); USED=${USED:-0}
AVAIL=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
ZFREE=$(( $(awk '/zram0/{print $3-$4}' /proc/swaps 2>/dev/null || echo 0) ))

echo "==> /swap.img holds $((USED/1024))M"
echo "==> RAM available: $((AVAIL/1024))M, zram free: $((ZFREE/1024))M"

if (( USED == 0 )); then echo "Already empty - nothing to do."; exit 0; fi
if (( USED + 262144 > AVAIL + ZFREE )); then
  echo "!! Not enough room to absorb it. Close some apps and re-run."; exit 1
fi

echo "==> swapoff /swap.img  (reads pages back; may take a few seconds)"
time swapoff /swap.img

echo "==> swapon /swap.img   (re-arm as low-priority fallback)"
swapon /swap.img --priority -1

echo
echo "==> Result:"
swapon --show
echo
zramctl --output NAME,ALGORITHM,DISKSIZE,DATA,COMPR
echo
free -h
