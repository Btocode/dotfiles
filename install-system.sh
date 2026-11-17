#!/usr/bin/env bash
# Install the root-owned pieces: zram, sysctl tuning, IdeaPad battery limit
# (udev rule + boot service), and the amd_pmc kernel hooks.
#
#   sudo ./install-system.sh            zram everywhere; the IdeaPad parts only
#                                       on an IdeaPad Slim 3 15ARP10 (83K7)
#   sudo ./install-system.sh zram       just one part (zram|ideapad|amdpmc|terminal)
#   sudo ./install-system.sh --force-hardware   IdeaPad parts on any machine
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo ./install-system.sh"; exit 1; }
DOTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_USER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
WHAT="${1:-all}"
FORCE_HW=0; [[ $WHAT == --force-hardware ]] && { FORCE_HW=1; WHAT=all; }

# The IdeaPad pieces poke EC attributes and kernel modules of one laptop model.
is_ideapad_83k7() {
  [[ $(cat /sys/class/dmi/id/product_name 2>/dev/null) == 83K7* ]]
}

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
  # The EC can forget conservation mode after power loss; replay the user's
  # last choice (~/.local/state/battery-limit) at every boot.
  sed "s|@USER@|$TARGET_USER|" \
    "$DOTS/system/etc/systemd/system/battery-limit.service" \
    > /etc/systemd/system/battery-limit.service
  chmod 644 /etc/systemd/system/battery-limit.service
  systemctl daemon-reload
  systemctl enable battery-limit.service
  echo "    toggle with: battery-limit [on|off|toggle|status]"
}

do_terminal() {
  echo "==> Ghostty as x-terminal-emulator (older apps and scripts launch this)"
  if [[ -x /usr/bin/ghostty ]]; then
    update-alternatives --install /usr/bin/x-terminal-emulator x-terminal-emulator /usr/bin/ghostty 60
    update-alternatives --set x-terminal-emulator /usr/bin/ghostty
  else
    echo "    ghostty not installed; skipped"
  fi
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
  all)
    do_zram
    do_terminal
    if (( FORCE_HW )) || is_ideapad_83k7; then
      do_ideapad; do_amdpmc
    else
      echo "==> Skipping IdeaPad parts: this is a '$(cat /sys/class/dmi/id/product_name 2>/dev/null)', not an 83K7"
      echo "    (override with --force-hardware only if you know they apply)"
    fi ;;
  zram)    do_zram ;;
  ideapad) do_ideapad ;;
  amdpmc)  do_amdpmc ;;
  terminal) do_terminal ;;
  *) echo "usage: sudo ./install-system.sh [all|zram|ideapad|amdpmc|terminal]"; exit 2 ;;
esac
echo; echo "Done."
