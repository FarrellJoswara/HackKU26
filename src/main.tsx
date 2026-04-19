/**
 * @file Browser entry — mounts the React tree, registers audio, wires global
 * campaign subscribers, and installs shared UI affordances (click feedback).
 *
 * Side effects at module scope are intentionally idempotent so React 18
 * StrictMode’s development double-invocation does not duplicate listeners
 * or one-shot initialization.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerAllTracks } from './audio/tracks';
import { initCampaign } from './core/campaign/initCampaign';
import { installGlobalClickFx } from './ui/fx/installGlobalClickFx';
import './index.css';

registerAllTracks();
// Module-scope campaign event subscriber (idempotent — safe under
// React StrictMode's double-mount in dev).
initCampaign();
// Document-level click delegator that gives every interactive button in
// the app (shared `Button` component, title-hub Play/Settings, Island
// Run HUD + landing dialog, dev shortcuts, etc.) a sound + ripple +
// pulse on every click. Idempotent — safe under StrictMode double-mount.
installGlobalClickFx();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
