import { createBrowserCredentialStore } from './credential-store';

/**
 * The one credential store the browser app uses.
 *
 * A single instance because there is one device and one tab, and because a page that made its
 * own would read a different `localStorage` view of the same keys — the same value, but two
 * places to remember to clear on sign-out.
 */
export const credentialStore = createBrowserCredentialStore();
