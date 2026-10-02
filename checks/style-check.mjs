import fs from 'node:fs';
const css=fs.readFileSync('src/style.css','utf8');
function assert(ok,msg){if(!ok){console.error(msg);process.exit(1);}}
assert(css.includes('.story-scene') && css.includes('.story-line h1') && css.includes('.story-line h2'), 'story composition missing');
assert(css.includes('min-height: 48px') && css.includes(':focus-visible'), 'usable keyboard/touch targets missing');
assert(css.includes('@media (max-width: 800px)') && css.includes('@media (max-width: 420px)'), 'responsive layouts missing');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'reduced motion handling missing');
assert(css.includes('.question-scene::before') && css.includes('.reveal-scene::before'), 'scene-specific readability scrims missing');
assert(!/\.card\b|box-shadow:\s*0\s+\d+px\s+\d+px\s+rgba\([^)]*\)\s*;\s*border-radius:\s*\d+px/.test(css), 'card-like UI styling detected');
console.log('style verification passed');
