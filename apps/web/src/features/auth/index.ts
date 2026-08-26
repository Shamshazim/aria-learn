/**
 * The identity slice (P2H-12): who is using this device, and the screens that decide it.
 *
 * Everything else in the folder is internal — the api modules, the reducer, the storage.
 */
export { AuthProvider } from './model/auth.provider';
export type { AuthProviderDeps } from './model/auth.provider';
export { useAuth } from './hooks/useAuth';
export { useIdleWatch } from './hooks/useIdleWatch';
export { RequireChildSession } from './components/RequireChildSession';
export { RequireParent } from './components/RequireParent';
export { ChildPicker } from './components/ChildPicker';
export { ChildAvatar } from './components/ChildAvatar';
export { PinPad } from './components/PinPad';
export { PictureLogin } from './components/PictureLogin';
export { ParentSignInForm } from './components/ParentSignInForm';
export { IdleNotice } from './components/IdleNotice';
export { createIdentityApi } from './api/identity.api';
export type { IdentityApi } from './api/identity.api';
export { createSupabaseApi } from './api/supabase.api';
export { createParentSessionStore } from './model/parent-session';
