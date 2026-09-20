#!/usr/bin/env bash
# Install the root-owned pieces: zram, sysctl tuning, IdeaPad udev rule,
# and the amd_pmc kernel hooks. Each part is opt-in.
#
#   sudo ./install-system.sh            everything
#   sudo ./install-system.sh zram       just one part (zram|ideapad|amdpmc)
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo ./install-system.sh"; exit 1; }
DOTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_USER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
WHAT="${1:-all}"

do_zram() {
  echo "==> zram (compressed RAM swap)"
  command -v zramctl >/dev/null || apt-get install -y systemd-zram-generator
  install -m644 "$DOTS/system/etc/systemd/zram-generator.conf" /etc/systemd/zram-generator.conf
  install -m644 "$DOTS/system/etc/sysctl.d/99-zram.conf"       /etc/sysctl.d/99-zram.conf
  sysctl --quiet -p /etc/sysctl.d/99-zram.conf
  # A running zram0 ignores config changes, so tear it down before restarting.
  systemctl stop systemd-zram-setup@zram0.service 2>/dev/null || true
  swapoff /dev/zram0 2>/dev/null || true
  modprobe -r zram 2>/dev/null || true
  systemctl daemon-reload
  systemctl start systemd-zram-setup@zram0.service
  zramctl --output NAME,ALGORITHM,DISKSIZE
}

do_ideapad() {
  echo "==> IdeaPad battery conservation (passwordless toggle for $TARGET_USER)"
  sed "s|@USER@|$TARGET_USER|" \
    "$DOTS/system/etc/udev/rules.d/99-ideapad-conservation.rules" \
    > /etc/udev/rules.d/99-ideapad-conservation.rules
  chmod 644 /etc/udev/rules.d/99-ideapad-conservation.rules
  udevadm control --reload-rules
  udevadm trigger --subsystem-match=platform --attr-match=kernel=VPC2004:00 2>/dev/null || true
  echo "    toggle with: battery-limit [on|off|toggle|status]"
}

do_amdpmc() {
  echo "==> amd_pmc auto-removal hooks"
  install -m755 "$DOTS/system/usr/local/sbin/amd-pmc-fix-check" /usr/local/sbin/amd-pmc-fix-check
  for d in postinst.d postrm.d; do
    mkdir -p "/etc/kernel/$d"
    install -m755 "$DOTS/system/etc/kernel/postinst.d/zz-amd-pmc-fix-check" "/etc/kernel/$d/zz-amd-pmc-fix-check"
  done
  echo "    dry run: /usr/local/sbin/amd-pmc-fix-check --dry-run"
}

case "$WHAT" in
  all)     do_zram; do_ideapad; do_amdpmc ;;
  zram)    do_zram ;;
  ideapad) do_ideapad ;;
  amdpmc)  do_amdpmc ;;
  *) echo "usage: sudo ./install-system.sh [all|zram|ideapad|amdpmc]"; exit 2 ;;
esac
echo; echo "Done."
