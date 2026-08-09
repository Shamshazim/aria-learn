'use strict';

const { app, dialog } = require('electron');

/**
 * Keeps the app up to date without asking a parent to reinstall anything.
 *
 * How the pieces fit together:
 *
 *  - electron-updater downloads a new build and verifies its signature before applying it.
 *    On macOS that check is the code signature, which is why an unsigned build must not
 *    auto-update: without a signature there is nothing to verify, and an update channel you
 *    cannot verify is a way to install someone else's code on a child's computer. Updates
 *    therefore stay off until the app is signed.
 *
 *  - Only the read-only payload is replaced. The database, the downloaded models and the
 *    per-install secrets live under userData, which updates never touch (see paths.js), so
 *    accounts, children and progress survive.
 *
 *  - Schema changes ride along as ordinary Flyway migrations. The backend applies any new
 *    ones on the first launch after an update, in order, against the existing data
 *    directory — the same mechanism the app already uses, so a desktop update needs no
 *    special migration path. `baseline-on-migrate` is off in the desktop profile so an
 *    unexpected schema fails loudly instead of silently skipping migrations.
 */

async function checkForUpdates() {
  if (!app.isPackaged) return;

  // Unsigned builds have no verifiable provenance; see the note above.
  if (process.env.ARIA_UPDATES_ENABLED !== 'true') {
    console.info('Automatic updates are disabled for this build.');
    return;
  }

  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  // Never restart under a child mid-lesson; the update lands on the next launch.
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', async ({ version }) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 1,
      title: 'Update ready',
      message: `Aria Learn ${version} is ready to install.`,
      detail: 'Your account, children and their progress are kept.',
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err) => console.warn('Updater error:', err.message));

  await autoUpdater.checkForUpdates();
}

module.exports = { checkForUpdates };
