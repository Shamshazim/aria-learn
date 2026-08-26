/**
 * Where a device keeps its credentials.
 *
 * Two of them, with deliberately different lifetimes. The device grant is what a parent
 * authorised and survives the browser closing, so it goes in `localStorage`. The child's
 * session token lasts one sitting and must not outlive the tab, so it goes in
 * `sessionStorage` — a shared family tablet where a closed tab left a child signed in is
 * exactly the case P0-26's "locks on profile switch" is about.
 *
 * It is a port, not a call to `localStorage`, because P0-26 requires the same protocol to work
 * in a desktop shell where these live in the operating system's credential store. Only this
 * file would change.
 */
export type CredentialStore = Readonly<{
  deviceSecret(): string | null;
  rememberDevice(secret: string): void;
  forgetDevice(): void;
  sessionToken(): string | null;
  rememberSession(token: string): void;
  forgetSession(): void;
}>;

const DEVICE_KEY = 'aria.device.secret';
const SESSION_KEY = 'aria.child.session';

/**
 * Storage can throw rather than return null — a browser with site data blocked, or a private
 * window. A device that cannot remember its grant should ask for it again, not crash a child's
 * sign-in screen.
 */
function read(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: Storage | undefined, key: string, value: string | null): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // Nothing to do and nothing worth telling a child: the flow works without persistence,
    // it just asks again next time.
  }
}

export function createBrowserCredentialStore(
  local: Storage | undefined = globalThis.localStorage,
  session: Storage | undefined = globalThis.sessionStorage,
): CredentialStore {
  return {
    deviceSecret: () => read(local, DEVICE_KEY),
    rememberDevice: (secret) => {
      write(local, DEVICE_KEY, secret);
    },
    forgetDevice: () => {
      write(local, DEVICE_KEY, null);
    },
    sessionToken: () => read(session, SESSION_KEY),
    rememberSession: (token) => {
      write(session, SESSION_KEY, token);
    },
    forgetSession: () => {
      write(session, SESSION_KEY, null);
    },
  };
}

/** An in-memory store, for tests and for a shell that has not wired its own yet. */
export function createMemoryCredentialStore(): CredentialStore {
  let device: string | null = null;
  let session: string | null = null;

  return {
    deviceSecret: () => device,
    rememberDevice: (secret) => {
      device = secret;
    },
    forgetDevice: () => {
      device = null;
    },
    sessionToken: () => session,
    rememberSession: (token) => {
      session = token;
    },
    forgetSession: () => {
      session = null;
    },
  };
}
