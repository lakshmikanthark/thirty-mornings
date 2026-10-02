import { createPondRenderer } from './webgl.js';
import {
  announceState,
  getStoryState,
  setupReplay,
  setupSceneObserver,
  updateStoryState,
} from './story.js';

const root = document.documentElement;
const canvas = document.getElementById('pond-canvas');
const params = new URLSearchParams(window.location.search);
const reducedMotion = params.get('reduced') === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const forceUnavailable = params.get('force-no-webgl') === '1';

root.dataset.reducedMotion = reducedMotion ? 'true' : 'false';
let renderer = null;
let scheduled = false;
let currentState = getStoryState();

function applyState() {
  scheduled = false;
  currentState = getStoryState();
  updateStoryState(currentState);
  announceState(currentState);
  renderer?.setState(currentState);
  root.dataset.horizontalOverflow = document.documentElement.scrollWidth > window.innerWidth + 1 ? 'true' : 'false';
}
function scheduleState() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(applyState);
}
function initRenderer() {
  if (!canvas) { root.dataset.webgl = 'unavailable'; return; }
  renderer = createPondRenderer(canvas, { reducedMotion, forceUnavailable });
  root.dataset.webgl = renderer ? 'ready' : 'unavailable';
  if (renderer) {
    root.dataset.quality = renderer.quality?.name || 'unknown';
    root.dataset.rendererApi = 'webgl1';
    renderer.setState(currentState);
  }
}
function init() {
  setupReplay();
  setupSceneObserver();
  initRenderer();
  applyState();
  window.addEventListener('scroll', scheduleState, { passive: true });
  window.addEventListener('resize', scheduleState, { passive: true });
  window.addEventListener('pageshow', scheduleState);
  root.dataset.appReady = 'true';
  window.__LILY_PAD_APP__ = {
    get state() { return currentState; },
    get webgl() { return root.dataset.webgl; },
    get reducedMotion() { return reducedMotion; },
    get rendererApi() { return root.dataset.rendererApi || 'none'; },
  };
}
window.addEventListener('error', (event) => {
  root.dataset.runtimeError = 'true';
  console.error('[app] uncaught error', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  root.dataset.runtimeError = 'true';
  console.error('[app] unhandled rejection', event.reason);
});
init();
