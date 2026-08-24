import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import '@/styles/tokens.css';
import '@/styles/global.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
