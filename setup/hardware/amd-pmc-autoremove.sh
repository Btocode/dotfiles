#!/usr/bin/env bash
# Installs kernel hooks that auto-remove the DKMS amd_pmc keyboard-suspend workaround
# once Ubuntu's own kernel ships the fix. Run: sudo bash setup/hardware/amd-pmc-autoremove.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }

U="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
SRC="/home/$U/.local/src/amd-pmc-autoremove/amd-pmc-fix-check"
BIN=/usr/local/sbin/amd-pmc-fix-check
HOOK=zz-amd-pmc-fix-check

[[ -f "$SRC" ]] || { echo "!! $SRC missing"; exit 1; }

echo "==> Installing $BIN"
install -o root -g root -m 755 "$SRC" "$BIN"

echo "==> Installing kernel hooks (run after dkms on every kernel install/remove)"
for d in /etc/kernel/postinst.d /etc/kernel/postrm.d; do
  mkdir -p "$d"
  cat > "$d/$HOOK" <<EOF
#!/bin/sh
# Auto-remove amd_pmc DKMS workaround when Ubuntu's kernel ships the fix. Never blocks kernel changes.
$BIN || true
exit 0
EOF
  chmod 755 "$d/$HOOK"
  echo "   $d/$HOOK"
done

mkdir -p /var/lib/amd-pmc-fix

echo "==> Checking current kernels now"
"$BIN"

echo
echo "==> DONE. From now on this runs automatically whenever Ubuntu installs or removes a kernel."
echo "    You'll get a desktop notification at login when the workaround is removed."
echo "    History: journalctl -t amd-pmc-fix   |   cat /var/lib/amd-pmc-fix/events.log"
