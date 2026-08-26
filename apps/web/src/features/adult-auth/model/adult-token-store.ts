/**
 * Where the browser keeps the adult's provider access token.
 *
 * It is the vendor's token, not one Aria minted, and Aria verifies it on every request and
 * checks its own `adult_session` row alongside — so a token that survives here longer than the
 * session does is refused anyway (P0-28). `localStorage`, because a parent who closes the tab
 * should not have to ask for a new email, and the server's idle and absolute windows are what
 * actually bound the credential's life.
 *
 * A port for the same reason the child's is: a desktop shell keeps this in the operating
 * system's credential store, and only this file changes.
 */
export type AdultTokenStore = Readonly<{
  token(): string | null;
  remember(token: string): void;
  forget(): void;
}>;

const TOKEN_KEY = 'aria.adult.token';

export function createBrowserAdultTokenStore(
  storage: Storage | undefined = globalThis.localStorage,
): AdultTokenStore {
  return {
    token: () => {
      try {
        return storage.getItem(TOKEN_KEY) ?? null;
      } catch {
        return null;
      }
    },
    remember: (token) => {
      write(storage, token);
    },
    forget: () => {
      write(storage, null);
    },
  };
}

export function createMemoryAdultTokenStore(): AdultTokenStore {
  let held: string | null = null;
  return {
    token: () => held,
    remember: (token) => {
      held = token;
    },
    forget: () => {
      held = null;
    },
  };
}

function write(storage: Storage, value: string | null): void {
  try {
    if (value === null) storage.removeItem(TOKEN_KEY);
    else storage.setItem(TOKEN_KEY, value);
  } catch {
    // A browser with site data blocked signs the parent out at the end of the tab's life.
    // That is worse, not broken.
  }
}
