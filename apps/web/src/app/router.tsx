import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingState } from '@/components/LoadingState';
import { RequireChildSession, RequireParent } from '@/features/auth';

const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const ParentPage = lazy(() => import('@/pages/ParentPage'));
const SessionPage = lazy(() => import('@/pages/SessionPage'));
const SignInPage = lazy(() => import('@/pages/SignInPage'));
const SubjectPickerPage = lazy(() => import('@/pages/SubjectPickerPage'));
const WhoIsLearningPage = lazy(() => import('@/pages/WhoIsLearningPage'));

function route(element: React.JSX.Element): React.JSX.Element {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingState />}>{element}</Suspense>
    </ErrorBoundary>
  );
}

/** P2H-12: a child screen is never rendered without a session behind it. */
function childRoute(element: React.JSX.Element): React.JSX.Element {
  return route(<RequireChildSession>{element}</RequireChildSession>);
}

export const router = createBrowserRouter([
  { path: '/sign-in', element: route(<SignInPage />) },
  {
    path: '/who',
    element: route(
      <RequireParent>
        <WhoIsLearningPage />
      </RequireParent>,
    ),
  },
  {
    path: '/parent',
    element: route(
      <RequireParent>
        <ParentPage />
      </RequireParent>,
    ),
  },
  { path: '/', element: childRoute(<SubjectPickerPage />) },
  { path: '/choose', element: childRoute(<SubjectPickerPage />) },
  { path: '/session/:grade/:subject', element: childRoute(<SessionPage />) },
  { path: '*', element: route(<NotFoundPage />) },
]);
