import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LegalPage } from './components/common/LegalPage';
import { initObservability, reportError } from './observability';
import './styles/globals.css';

initObservability();

createRoot(document.getElementById('root')!, {
  // L'ErrorBoundary rattrape l'erreur pour l'utilisateur ; on la remonte quand même.
  onCaughtError: reportError,
}).render(
  <StrictMode>
    <ErrorBoundary>
      {window.location.pathname === '/legal' ? <LegalPage /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);
