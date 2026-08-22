#!/usr/bin/env bash
#
# Signs, notarizes and staples the built disk image, then refuses to continue unless macOS
# agrees a stranger could open it.
#
# electron-builder signs and notarizes the .app and *then* wraps it in a DMG, so the DMG itself
# comes out bare. That is not a cosmetic gap: a browser quarantines the download, and macOS
# assesses the disk image before anyone reaches the good app inside — so the parent is stopped
# at the very first step, by the very thing signing was bought to prevent.
#
# Stapling a ticket to the DMG is not enough on its own; without a Developer ID signature the
# system still reports "no usable signature". The disk image needs all three: sign, notarize,
# staple. Verified against a real build — spctl accepts it as "Notarized Developer ID" and
# syspolicy_check reports it ready for distribution.
#
# Does nothing when the signing secrets are absent, so a fork still builds.

set -euo pipefail

DIST_DIR="${1:-dist}"

log() { printf '  • %s\n' "$1"; }

if [ "$(uname -s)" != "Darwin" ]; then
  log "not macOS; nothing to notarize"
  exit 0
fi

if [ -z "${CSC_LINK:-}" ] || [ -z "${APPLE_ID:-}" ] \
   || [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] || [ -z "${APPLE_TEAM_ID:-}" ]; then
  log "no signing credentials; leaving the disk image unsigned"
  exit 0
fi

shopt -s nullglob
DMGS=("$DIST_DIR"/*.dmg)
shopt -u nullglob
if [ ${#DMGS[@]} -eq 0 ]; then
  log "no .dmg in $DIST_DIR; nothing to do"
  exit 0
fi

# The keychain electron-builder used for the app is gone by now — it lives and dies inside that
# process — so the certificate is imported again here, into a keychain of our own.
WORK="$(mktemp -d)"
KEYCHAIN="$WORK/notarize.keychain-db"
KEYCHAIN_PASSWORD="$(openssl rand -base64 24)"
ORIGINAL_KEYCHAINS="$(security list-keychains -d user | sed 's/[[:space:]]*"//g')"

cleanup() {
  # shellcheck disable=SC2086
  security list-keychains -d user -s $ORIGINAL_KEYCHAINS 2>/dev/null || true
  security delete-keychain "$KEYCHAIN" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

log "importing the Developer ID certificate"
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
printf '%s' "$CSC_LINK" | base64 --decode > "$WORK/cert.p12"
security import "$WORK/cert.p12" -k "$KEYCHAIN" -P "${CSC_KEY_PASSWORD:-}" \
  -T /usr/bin/codesign -T /usr/bin/security >/dev/null
# Without this, codesign blocks on a GUI prompt that will never be answered on a runner.
security set-key-partition-list -S apple-tool:,apple:,codesign: \
  -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN" >/dev/null
# shellcheck disable=SC2086
security list-keychains -d user -s "$KEYCHAIN" $ORIGINAL_KEYCHAINS

IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN" \
  | awk '/Developer ID Application/ { print $2; exit }')"
if [ -z "$IDENTITY" ]; then
  echo "Error: no Developer ID Application identity in the imported certificate." >&2
  exit 1
fi
log "signing identity $IDENTITY"

for dmg in "${DMGS[@]}"; do
  log "signing $(basename "$dmg")"
  codesign --force --timestamp --keychain "$KEYCHAIN" --sign "$IDENTITY" "$dmg"

  log "notarizing $(basename "$dmg") — Apple can take anywhere from minutes to an hour"
  xcrun notarytool submit "$dmg" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait

  log "stapling the ticket so it verifies offline"
  xcrun stapler staple "$dmg"

  # The point of the whole exercise. Ask the system, rather than assume.
  log "asking Gatekeeper whether a stranger could open it"
  if ! spctl -a -vv -t open --context context:primary-signature "$dmg"; then
    echo "Error: Gatekeeper rejected $(basename "$dmg") after notarization." >&2
    exit 1
  fi
done

log "disk image is signed, notarized and stapled"
