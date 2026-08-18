#!/usr/bin/env bash
#
# Loads the five Apple signing secrets into the GitHub repository, so the next tagged release
# comes out signed and notarized.
#
# Run this once, after the Developer ID certificate exists and has been exported as a .p12
# (docs/apple-signing.md steps 1–3). It only writes secrets — it changes no code, and the
# build needs no other switch.
#
#   ./scripts/setup-signing-secrets.sh ~/Desktop/aria-signing.p12
#
# Nothing here is echoed back or written to disk: values are read silently and piped straight
# to `gh secret set`. Anyone holding them can sign software as you, and that signature is what
# tells a parent the app is safe.

set -euo pipefail

REPO="${ARIA_REPO:-Shamshazim/aria-learn}"
P12="${1:-}"

die() { printf '\nError: %s\n' "$1" >&2; exit 1; }

[ -n "$P12" ] || die "Usage: $0 <path-to-developer-id.p12>"
[ -f "$P12" ] || die "No such file: $P12"
command -v gh >/dev/null || die "The GitHub CLI (gh) is not installed."
gh auth status >/dev/null 2>&1 || die "Not logged in to GitHub. Run: gh auth login"

# A Developer ID Application certificate in the keychain is not required to set the secrets,
# but its absence usually means the wrong file is about to be uploaded.
if ! security find-identity -v -p codesigning 2>/dev/null | grep -q "Developer ID Application"; then
  printf 'Warning: no "Developer ID Application" identity found in your keychain.\n'
  printf 'Check you exported the right certificate before continuing.\n\n'
  read -r -p "Continue anyway? [y/N] " reply
  [ "$reply" = "y" ] || [ "$reply" = "Y" ] || die "Stopped."
fi

printf 'Loading signing secrets into %s\n\n' "$REPO"

# The .p12 is binary, so it goes in base64-encoded; the rest are typed in.
base64 -i "$P12" | gh secret set MAC_CERTIFICATE_P12 --repo "$REPO"
printf '  set MAC_CERTIFICATE_P12\n'

prompt_secret() {
  local name="$1" description="$2" value
  read -r -s -p "$description: " value
  printf '\n'
  [ -n "$value" ] || die "$name cannot be empty."
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO"
  printf '  set %s\n' "$name"
}

prompt_secret MAC_CERTIFICATE_PASSWORD      "Password protecting the .p12 export"
prompt_secret APPLE_ID                      "Apple ID email that owns the membership"
prompt_secret APPLE_APP_SPECIFIC_PASSWORD   "App-specific password (appleid.apple.com)"
prompt_secret APPLE_TEAM_ID                 "Team ID (10 characters)"

printf '\nSecrets now on %s:\n' "$REPO"
gh secret list --repo "$REPO"

cat <<'NEXT'

Next:
  1. Set UNSIGNED_BUILD = false in aria-learn-site/downloads.html and push it.
  2. Release:  git tag v0.1.0 && git push origin v0.1.0
  3. Verify the published installer on a Mac:
       spctl -a -vv -t open --context context:primary-signature ~/Downloads/Aria-Learn-*.dmg
     "accepted" with "source=Notarized Developer ID" means a parent can double-click it.
NEXT
