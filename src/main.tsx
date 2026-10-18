import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import App from '@/App';
import { applyAccent, getSavedAccent } from '@/ui/theme';

applyAccent(getSavedAccent());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
