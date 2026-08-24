import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';

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
