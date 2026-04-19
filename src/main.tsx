import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerAllTracks } from './audio/tracks';
import { initCampaign } from './core/campaign/initCampaign';
import './index.css';

registerAllTracks();
// Module-scope campaign event subscriber (idempotent — safe under
// React StrictMode's double-mount in dev).
initCampaign();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
