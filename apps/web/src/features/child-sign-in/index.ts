/**
 * The feature's public surface. Pages import from here, never from a file inside it.
 */
export { createChildAuthApi, childProfileSchema, childSessionSchema } from './api/child-auth.api';
export type { ChildAuthApi, ChildProfile, ChildSession } from './api/child-auth.api';
export { withChildSession } from './api/with-child-session';
export { RequireChildSession } from './components/RequireChildSession';
export { SignOutButton } from './components/SignOutButton';
export { useChildSignIn } from './hooks/useChildSignIn';
export type { ChildSignInViewModel } from './hooks/useChildSignIn';
export {
  createBrowserCredentialStore,
  createMemoryCredentialStore,
} from './model/credential-store';
export type { CredentialStore } from './model/credential-store';
export { credentialStore } from './model/store.instance';
