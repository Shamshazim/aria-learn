# Getting an Apple certificate, step by step

This is the one thing standing between the current build and a parent being able to install
Aria Learn. Without it macOS refuses to open the app on any machine other than the one that
built it.

Budget about **an hour of your time**, plus waiting for Apple to approve the enrolment
(usually a day or two), plus **$99/year**.

---

## What you are actually getting, and why

Two separate things, both required:

| | What it does |
|---|---|
| **Signing** | Stamps the app with your identity, proving it hasn't been tampered with since you built it |
| **Notarization** | Uploads the signed app to Apple, who scan it and issue a ticket saying it's clean |

Signing alone isn't enough. A signed-but-unnotarized app still shows "cannot be opened because
the developer cannot be verified", and the user has to right-click → Open. Only notarization
gives the clean double-click install this project is aiming for.

The certificate type you need is **Developer ID Application**. Two neighbouring options are
wrong and easy to pick by mistake:

- *Mac App Distribution* — for the Mac App Store, which this app is not going to
- *Developer ID Installer* — for `.pkg` installers. This project ships a `.dmg`, so it needs
  the Application variant

---

## Step 1 — Enrol in the Apple Developer Program

**Cost:** $99/year, renewed annually. If it lapses, existing builds keep working but you can't
notarize new ones.

1. You need an Apple ID with **two-factor authentication** already switched on. Enrolment will
   refuse without it.
2. Go to <https://developer.apple.com/programs/enroll/>.
3. Choose **Individual** unless you have a registered company.
   - **Individual** — fastest. Uses your legal name, no paperwork. Your name appears as the
     developer on the install dialog.
   - **Organization** — requires a D-U-N-S number for the legal entity and takes considerably
     longer, often weeks. Choose this only if the app must be published under a company name.
4. Pay, then wait. Individual enrolments are often approved within 24–48 hours.

> Enrolling through the **Apple Developer** app on an iPhone or iPad is frequently faster than
> the website, because it can verify your identity using the device.

**A free Apple Developer account cannot create a Developer ID certificate.** This step is not
skippable.

---

## Step 2 — Create the certificate

The easy way, if you have Xcode installed:

1. **Xcode → Settings → Accounts**
2. Add your Apple ID, select the team, click **Manage Certificates…**
3. Click **+** → **Developer ID Application**

It's created and installed into your keychain in one go.

<details>
<summary>Without Xcode — the manual route</summary>

1. Open **Keychain Access**
2. Menu: **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate
   Authority…**
3. Enter your email and name, choose **Saved to disk**, and save the `.certSigningRequest` file
4. Go to <https://developer.apple.com/account/resources/certificates/list>
5. Click **+**, choose **Developer ID Application**, upload the request file
6. Download the resulting `.cer` and double-click it to install it into your keychain

</details>

Verify it worked:

```bash
security find-identity -v -p codesigning
```

You should see a line containing `Developer ID Application: Your Name (TEAMID)`. If it says
*0 valid identities found*, the certificate isn't installed yet.

> **Back up the certificate now.** Export it as a `.p12` (next step) and keep that file
> somewhere safe and private. If you lose your Mac without it, you cannot recreate the same
> certificate — you can only issue a new one, and you're limited in how many you may hold.

---

## Step 3 — Collect the five values CI needs

### `MAC_CERTIFICATE_P12`

Export the certificate and base64-encode it so it can live in a secret:

1. **Keychain Access → My Certificates**
2. Right-click your *Developer ID Application* certificate → **Export…**
3. Save as `.p12` and set a password when prompted — remember it, it's the next secret
4. Encode it:

```bash
base64 -i ~/Desktop/aria-signing.p12 | pbcopy
```

The base64 text is now on your clipboard. Paste that as the secret value.

### `MAC_CERTIFICATE_PASSWORD`

The password you just set on the `.p12` export.

### `APPLE_ID`

The Apple ID email address that owns the developer membership.

### `APPLE_APP_SPECIFIC_PASSWORD`

Your real Apple password won't work for notarization, and shouldn't be used anyway.

1. Go to <https://appleid.apple.com> → **Sign-In and Security** → **App-Specific Passwords**
2. Generate one, name it something like `aria-learn-notarization`
3. Copy it immediately — it's shown only once

### `APPLE_TEAM_ID`

The 10-character identifier at
<https://developer.apple.com/account> → **Membership details** → *Team ID*.

---

## Step 4 — Add them to GitHub

Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
Add all five, named exactly:

```
MAC_CERTIFICATE_P12
MAC_CERTIFICATE_PASSWORD
APPLE_ID
APPLE_APP_SPECIFIC_PASSWORD
APPLE_TEAM_ID
```

Or from the terminal:

```bash
gh secret set MAC_CERTIFICATE_P12 --repo Shamshazim/aria-learn < <(base64 -i aria-signing.p12)
gh secret set MAC_CERTIFICATE_PASSWORD --repo Shamshazim/aria-learn
gh secret set APPLE_ID --repo Shamshazim/aria-learn
gh secret set APPLE_APP_SPECIFIC_PASSWORD --repo Shamshazim/aria-learn
gh secret set APPLE_TEAM_ID --repo Shamshazim/aria-learn
```

**Never commit the `.p12` or any of these values.** Anyone holding them can sign software as
you, and that signature is what tells a parent the app is safe.

---

## Step 5 — Nothing to change in the build

The build already signs and notarizes by default. The release workflow only opts out when
`MAC_CERTIFICATE_P12` is absent, so adding the secrets is the whole switch — the next tagged
release comes out signed.

Two other places to update once it works:

| Where | Change |
|---|---|
| `aria-learn-site/downloads.html` | Set `UNSIGNED_BUILD = false`. It controls the `xattr` instructions, which become wrong and confusing once builds are signed |
| `desktop/src/updater.js` | Auto-update stays off until `ARIA_UPDATES_ENABLED=true`. Only turn it on once signed — on macOS the signature *is* what makes an update verifiable |

---

## Step 6 — Check it actually worked

Download the published `.dmg` on a Mac and ask the system directly:

```bash
spctl -a -vv -t open --context context:primary-signature ~/Downloads/Aria-Learn-0.1.0-arm64.dmg
```

`accepted` with `source=Notarized Developer ID` means a parent can now double-click it.
`rejected` means something didn't take.

Also confirm the notarization ticket is attached to the installed app:

```bash
xcrun stapler validate "/Applications/Aria Learn.app"
```

---

## When it goes wrong

| Symptom | Cause |
|---|---|
| `0 valid identities found` | Certificate not installed, or you created the wrong type. It must be *Developer ID Application* |
| Notarization rejected: "not signed with a valid Developer ID" | The build signed with an ad-hoc identity. Check `MAC_CERTIFICATE_P12` actually decoded |
| Notarization rejected: "hardened runtime not enabled" | `hardenedRuntime: true` is already set here; if you see this, something overrode it |
| Notarization hangs for a long time | Normal. Apple's service can take from a few minutes to well over an hour |
| App is notarized but still won't launch | Usually an entitlement. This app spawns a JVM, PostgreSQL and Ollama, which is why `build/entitlements.mac.plist` allows JIT and unsigned executable memory |
| `The specified item could not be found in the keychain` in CI | The `.p12` didn't import — nearly always a wrong `MAC_CERTIFICATE_PASSWORD` |

---

## Windows, briefly

Windows has the same problem with a different name: SmartScreen warns on downloads from an
unknown publisher. The fix is an Authenticode certificate from a commercial CA, typically
$200–500/year, and since 2023 these generally require hardware token or cloud HSM storage,
which complicates CI signing. Worth treating as a separate project from the Mac work.
