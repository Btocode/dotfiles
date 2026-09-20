#!/usr/bin/env bash
# Fix: keyboard dead after suspend on Lenovo IdeaPad Slim 3 15ARP10 (83K7).
# Installs the patched amd_pmc driver (delays s2idle by 2.5s) via DKMS.
# Source: https://github.com/DanielGibson/amd_pmc-ideapad @ 783d5d9 (reviewed copy in ~/.local/src)
# Run: sudo bash setup/hardware/keyboard-suspend-fix.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Run with sudo"; exit 1; }

U="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
SRC="/home/$U/.local/src/amd_pmc-ideapad"
PKG=amd_pmc
VER=0.0.4
COMMIT=783d5d93fa89685162ccdc747e04fe2891a2dbae
KVER="$(uname -r)"

echo "==> Checking source"
[[ -f "$SRC/dkms.conf" ]] || { echo "!! $SRC missing"; exit 1; }
got=$(sudo -u "$U" git -C "$SRC" rev-parse HEAD)
[[ "$got" == "$COMMIT" ]] || { echo "!! source is at $got, expected reviewed commit $COMMIT"; exit 1; }
grep -q "PACKAGE_VERSION=\"$VER\"" "$SRC/dkms.conf" || { echo "!! dkms.conf version is not $VER"; exit 1; }
echo "   ok: $COMMIT (v$VER)"

echo "==> Installing DKMS and kernel headers (current + future kernels)"
apt-get update -qq
apt-get install -y dkms "linux-headers-$KVER" linux-headers-generic

echo "==> Removing any previous $PKG DKMS versions"
for v in $(dkms status -m "$PKG" 2>/dev/null | sed -E "s|^$PKG/([^,:]+).*|\1|" | sort -u); do
  dkms remove -m "$PKG" -v "$v" --all || true
done
rm -rf "/usr/src/$PKG-$VER"

echo "==> Copying source to /usr/src/$PKG-$VER"
mkdir -p "/usr/src/$PKG-$VER"
cp "$SRC"/{dkms.conf,Makefile,LICENSE,pmc.c,pmc.h,pmc-quirks.c,mp1_stb.c,mp2_stb.c} "/usr/src/$PKG-$VER/"

echo "==> Building and installing with DKMS"
dkms add -m "$PKG" -v "$VER"
dkms build -m "$PKG" -v "$VER" -k "$KVER"
dkms install -m "$PKG" -v "$VER" -k "$KVER" --force
depmod -a "$KVER"

echo "==> Verifying"
file=$(modinfo -k "$KVER" -n amd_pmc)
echo "   module file: $file"
if modinfo -k "$KVER" -p amd_pmc | grep -q '^delay_suspend:'; then
  echo "   ok: installed driver has the delay_suspend fix"
else
  echo "!! installed driver does not have delay_suspend — something went wrong"; exit 1
fi
dkms status -m "$PKG"

echo
echo "==> DONE. Reboot now (do NOT suspend before rebooting)."
echo "    After reboot, check with:"
echo "      cat /sys/module/amd_pmc/parameters/delay_suspend   # -1 = auto"
echo "      journalctl -k -b | grep 'Delaying suspend by 2.5s'   # after the first sleep: 'to avoid platform bug'"
