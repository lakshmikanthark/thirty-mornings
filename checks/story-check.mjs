import fs from 'node:fs';
const html = fs.readFileSync('index.html','utf8');
function assert(ok, msg) { if (!ok) { console.error(msg); process.exit(1); } }
assert((html.match(/class="story-scene/g)||[]).length === 10, 'expected ten story scenes');
assert(html.includes('Here’s a question.'), 'question opening missing');
assert(html.includes('When was the pond half covered?'), 'main riddle question missing');
assert(html.includes('thinking-space'), 'thinking pause missing');
assert(!/data-answer=|answer-grid|quiz-feedback/.test(html), 'multiple-choice UI should be removed');
assert(html.includes('Somewhere around Day 15… right?'), 'Day 15 intuition beat missing');
assert(html.includes('But no. It’s Day 29.'), 'Day 29 reveal missing');
assert(html.includes('Day 29 → 50%. Day 30 → 100%.'), 'doubling explanation missing');
assert(html.includes('We do this in life too.'), 'life analogy missing');
assert(html.includes('Don’t quit at Day 28.'), 'life payoff missing');
assert(!/features|pricing|testimonials|learn more|get started|chapter-number|day-meter/i.test(html), 'website-like chrome or labels remain in visible markup');
assert(!/<nav\b|<header\b|<footer\b/i.test(html), 'site chrome should not frame the story');
const beforeQuestion = html.slice(0, html.indexOf('question-scene'));
assert(!/50%|Day 29|12\.5%|25%/.test(beforeQuestion), 'answer clues appear before the question');
console.log('story question-pause-life verification passed');
