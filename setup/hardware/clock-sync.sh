#!/usr/bin/env bash
# Fix the system clock (about 8h fast) and get chrony syncing. Run: sudo bash setup/hardware/clock-sync.sh
set -uo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }

echo "==> Before: $(date '+%Y-%m-%d %H:%M:%S %Z')"

echo "==> Setting the clock once from NTP (secure NTS first, plain NTP as fallback)"
systemctl stop chrony
if ! timeout 30 chronyd -q -t 25 'server time.cloudflare.com iburst nts'; then
  echo "   NTS one-shot failed, using plain NTP for the initial set"
  timeout 30 chronyd -q -t 25 'pool pool.ntp.org iburst' || { echo "!! could not set clock"; systemctl start chrony; exit 1; }
fi
hwclock --systohc && echo "   hardware clock updated"
systemctl start chrony
echo "==> After:  $(date '+%Y-%m-%d %H:%M:%S %Z')"

echo "==> Waiting for chrony's secure (NTS) sources to sync"
for _ in $(seq 1 12); do
  chronyc -n sources | grep -qE '^\^\*' && break
  sleep 5
done

if chronyc -n sources | grep -qE '^\^\*'; then
  echo "   synced via NTS (secure) — no config change needed"
else
  echo "   NTS still not syncing — adding plain NTP as a fallback source"
  cat > /etc/chrony/sources.d/fallback-ntp.sources <<EOF
pool pool.ntp.org iburst maxsources 3
EOF
  chronyc reload sources >/dev/null
  sleep 15
fi

echo
chronyc tracking | grep -E 'Reference ID|System time|Leap status'
chronyc -n sources
chronyc -n authdata 2>/dev/null
timedatectl | grep -E 'Local time|Time zone|synchronized'
