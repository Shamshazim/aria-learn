import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { webConfig } from '@/app/config';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingState } from '@/components/LoadingState';
import { credentialStore, RequireChildSession } from '@/features/child-sign-in';

const AdultSignInPage = lazy(() => import('@/pages/AdultSignInPage'));
const ChildSignInPage = lazy(() => import('@/pages/ChildSignInPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const SessionPage = lazy(() => import('@/pages/SessionPage'));
const SubjectPickerPage = lazy(() => import('@/pages/SubjectPickerPage'));

function route(element: React.JSX.Element): React.JSX.Element {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingState />}>{element}</Suspense>
    </ErrorBoundary>
  );
}

/** A route only a signed-in child reaches. Everything that tutors is one of these. */
function childRoute(element: React.JSX.Element): React.JSX.Element {
  return route(
    <RequireChildSession required={webConfig.childSessionRequired} store={credentialStore}>
      {element}
    </RequireChildSession>,
  );
}

export const router = createBrowserRouter([
  { path: '/', element: childRoute(<SubjectPickerPage />) },
  { path: '/hello', element: route(<ChildSignInPage />) },
  { path: '/grown-ups', element: route(<AdultSignInPage />) },
  { path: '/choose', element: childRoute(<SubjectPickerPage />) },
  { path: '/session/:grade/:subject', element: childRoute(<SessionPage />) },
  { path: '*', element: route(<NotFoundPage />) },
]);
