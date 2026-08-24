import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingState } from '@/components/LoadingState';

const HomePage = lazy(() => import('@/pages/HomePage'));
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

export const router = createBrowserRouter([
  { path: '/', element: route(<HomePage />) },
  { path: '/choose', element: route(<SubjectPickerPage />) },
  { path: '/session/:grade/:subject', element: route(<SessionPage />) },
  { path: '*', element: route(<NotFoundPage />) },
]);
