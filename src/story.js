import { formatPercent, storyStateForProgress } from './math.js';

export const sceneStops = [0.00, 0.10, 0.27, 0.45, 0.62, 0.72, 0.82, 0.91, 0.955, 1.00];

export function getDocumentProgress() {
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(1, Math.max(0, window.scrollY / max));
}

export function getNarrativeProgress() {
  const scenes = [...document.querySelectorAll('.story-scene')];
  if (!scenes.length) return getDocumentProgress();
  const viewportCenter = window.scrollY + window.innerHeight * 0.5;
  const centers = scenes.map((scene) => {
    const rect = scene.getBoundingClientRect();
    return window.scrollY + rect.top + rect.height * 0.5;
  });
  if (viewportCenter <= centers[0]) return sceneStops[0];
  if (viewportCenter >= centers[centers.length - 1]) return sceneStops[sceneStops.length - 1];
  for (let i = 0; i < centers.length - 1; i += 1) {
    if (viewportCenter >= centers[i] && viewportCenter <= centers[i + 1]) {
      const local = (viewportCenter - centers[i]) / Math.max(1, centers[i + 1] - centers[i]);
      return sceneStops[i] + (sceneStops[i + 1] - sceneStops[i]) * local;
    }
  }
  return getDocumentProgress();
}

export function getStoryState() {
  return storyStateForProgress(getNarrativeProgress());
}

export function updateStoryState(state) {
  document.documentElement.style.setProperty('--coverage', String(state.coverage));
  document.documentElement.style.setProperty('--coverage-radius', `${Math.max(2, Math.sqrt(state.coverage) * 76)}%`);
  document.documentElement.style.setProperty('--story-progress', String(state.progress));
}

export function setupReplay() {
  document.getElementById('replay-button')?.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });
}

export function setupSceneObserver() {
  const scenes = [...document.querySelectorAll('.story-scene')];
  if (!('IntersectionObserver' in window)) return () => {};
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.30) {
        scenes.forEach((scene) => scene.classList.toggle('is-active', scene === entry.target));
      }
    });
  }, { threshold: [0.30, 0.55] });
  scenes.forEach((scene) => observer.observe(scene));
  return () => observer.disconnect();
}

export function announceState(state) {
  document.body.dataset.day = String(state.displayDay);
  document.body.dataset.coverageLabel = formatPercent(state.percent);
  const status = document.getElementById('story-status');
  if (status && status.dataset.lastDay !== String(state.displayDay)) {
    status.dataset.lastDay = String(state.displayDay);
    status.textContent = `Day ${state.displayDay}. ${formatPercent(state.percent)} of the pond is covered.`;
  }
}
