# Giving Aria Learn to someone else

What has to be true before another family can download and run this, and what it costs.

## The short version

The build works. Distribution does not, yet — for one reason:

**macOS will refuse to open the current build on anyone else's Mac.** It is ad-hoc signed with
no Developer ID and is not notarized, so Gatekeeper rejects it outright (`source=no usable
signature`). This is not a warning a parent can click past; the app simply will not open.

Fixing that costs **$99/year** for an Apple Developer Program membership. There is no free
path that keeps the "download and double-click" experience the product is aiming for.

## What each audience needs

### A non-technical parent — the target user

Requires signing and notarization. Nothing else will do: every workaround below involves the
Terminal, and a product whose install instructions include `xattr` is not one you hand to a
parent.

1. Join the Apple Developer Program ($99/year) and create a **Developer ID Application**
   certificate.
2. Add these repository secrets:

   | Secret | What it is |
   |---|---|
   | `MAC_CERTIFICATE_P12` | the certificate, exported as `.p12` and base64-encoded |
   | `MAC_CERTIFICATE_PASSWORD` | the password protecting that export |
   | `APPLE_ID` | the Apple ID that owns the membership |
   | `APPLE_APP_SPECIFIC_PASSWORD` | an app-specific password from appleid.apple.com |
   | `APPLE_TEAM_ID` | the 10-character team identifier |

3. Remove `identity: null` from `desktop/electron-builder.yml` and set
   `notarize: true` under `mac`.
4. Push a tag: `git tag v0.1.0 && git push origin v0.1.0`.

The release workflow builds on both an Apple Silicon and an Intel runner, signs, notarizes,
and publishes both installers to GitHub Releases. The download page is then the repository's
Releases page, and `electron-updater` uses the same feed for updates.

Set `ARIA_UPDATES_ENABLED=true` once signed — auto-update stays off until then, because on
macOS the signature *is* what makes an update verifiable, and an update channel you cannot
verify is a way to install someone else's code on a child's computer.

### A technical friend — works today, no certificate

Send them the `.dmg` and this, which strips the download quarantine flag:

```bash
xattr -dr com.apple.quarantine "/Applications/Aria Learn.app"
```

They drag the app to Applications first, then run that once. Honest framing: they are choosing
to run software macOS could not verify, on your word alone.

### Windows

Configured in `electron-builder.yml` (NSIS) but **never built or tested**. It also needs its
own code-signing certificate (typically $200–500/year) or SmartScreen will warn on download.
Treat Windows as unstarted work rather than nearly done.

## What the other person's machine needs

Worth saying plainly, because it rules some people out:

| | |
|---|---|
| Disk | ~7.5 GB — 612 MB app plus 6.6 GB of AI models |
| Memory | 16 GB recommended. The 7B model is the constraint; 8 GB will swap badly |
| Chip | Apple Silicon strongly preferred. Intel Macs work but generate lessons slowly |
| Internet | Needed **once**, on first launch, to download the models. Never again |
| macOS | 10.13+ (Electron 33's floor) |

A parent on an 8 GB Intel MacBook will find lessons take tens of seconds. That is a real
product limit, not a bug, and it comes from choosing to run the AI locally so no child's data
ever leaves the machine.

## Publishing a release

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow runs the backend and desktop test suites first and will not publish if they fail.
Installers are also uploaded as build artifacts, so a failed publish never loses the build.

Without signing secrets configured the workflow still succeeds and still publishes — but it
emits a loud warning, and what it publishes will not open on anyone else's Mac. That is
intentional: a broken download should be noisy, not silent.

## Before sharing it widely

- [ ] Give the app an icon — it currently uses the default Electron one
- [ ] Test on a Mac that has never run any of this, with no JDK, PostgreSQL or Ollama
- [ ] Watch a real first-run model download end to end (6.6 GB has never been exercised in full)
- [ ] Decide what happens when the download is interrupted or the disk fills mid-pull
- [ ] Confirm the `desktop` profile is what ships — `DataInitializer` must not seed
      `parent@demo.com`, and the JWT guard must reject the development key
