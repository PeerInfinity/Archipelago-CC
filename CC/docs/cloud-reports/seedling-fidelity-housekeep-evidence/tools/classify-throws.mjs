#!/usr/bin/env node
// HOUSEKEEP D1 — classify census-throws.mjs's rows (stdin, JSON lines) into (a)/(b), by the throw's own words + a
// few named overrides. Prints a markdown table and the class totals. Usage:
//   node census-throws.mjs | node classify-throws.mjs > d1/census-table.md
import fs from 'node:fs';
const rows = fs.readFileSync(0, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const HAMMER_FNS = new Set(['deriveFight', 'spinnerForecastWithPress', 'pointAt', 'snap', 'fork', 'spaceTimeReach', 'coarseKey']);
const HAMMER_FILES = new Set(['frontend/modules/seedlingDemo/spaceTimeReach.js']);
// Named overrides, keyed `function|lead-in` (line numbers move): the rows whose words no rule below reads right.
const OVERRIDE = {
    "entities|previewPressApproach: a previewed tick has no '${}' — the view ": ['b-invariant', 'hammer'],
    'deriveFight|deriveFight: order "${}" is not astar, progress, stage or nearest': ['b-arg', 'hammer'],
    'spaceTimeReach|spaceTimeReach: the earliest mode answers "when is the goal first reached" — it needs a goal': ['b-arg', 'hammer'],
    "buildLevelWorld|levelWorld: level ${}'s `${}` at ": ['a-gap', null],
    'buildLevelWorld|levelWorld: `${}` is a talker but its class ': ['b-invariant', null],
    'advance|levelRun: the player died (${}) at tick ': ['a-gap', null],
    // a press inside an open fire / wand window: the solver DERIVES the cadence (`FIRE_PRESS_CADENCE`), so a hit is its bug
    'advance|levelRun: a fire press at tick ${} ': ['b-invariant', null],
    'advance|levelRun: a wand press at tick ${} ': ['b-invariant', null],
};
const RULES = [
    ['a-converted', (r) => r.code === 'FROZEN_TICK_PRESS'],
    ['b-tape', (r) => /^levelRun: the tape |^levelRun: an X release|tape presses X|tape equips|tape already equips|tape holds/.test(r.msg)],
    ['b-arg', (r) => /must be|is not a |are required|required function|\bunknown\b|got \$\{\}|is neither|needs a body|pass the level size|has no `ctor`|is not an update count|is not a positive|this run is noclip|is not a tick|no row \$\{\} to fork|not reached$|is not a forecast|no player position|no parseable|carries force|has no transcribed volume|a ceremony with no pages|NO samples|must be finite|carries no absolute tick|does not $|all landed inside one tick|cannot end/.test(r.msg)],
    ['b-invariant', (r) => /did not converge|disagreement|DISAGREE|never released|pass [12] (and|spent)|both hand over|declared tick must|was about to self-declare|produced a |the dark suit's retaliation KILLS|is not on screen|lies |a second SealPiece|opened with|reported taken/.test(r.msg)],
    ['a-gap', (r) => /^levelRun|^chaserForecast|^combatCensus|^plannerContactFree|^ghostSlashHitTicksFor/.test(r.msg) || r.msg === ''],
];
const owner = (r) => (HAMMER_FILES.has(r.file) || HAMMER_FNS.has(r.fn) ? 'hammer' : null);
const out = [];
const totals = {};
for (const r of rows) {
    const key = `${r.fn}|${r.msg}`;
    let cls = OVERRIDE[key]?.[0] ?? RULES.find(([, f]) => f(r))?.[0] ?? 'UNCLASSIFIED';
    const own = OVERRIDE[key]?.[1] ?? owner(r);
    totals[cls] = (totals[cls] ?? 0) + 1;
    out.push({ ...r, cls, own });
}
console.log('| site | function | class | owner | code | the throw\'s lead-in |');
console.log('|---|---|---|---|---|---|');
for (const r of out) {
    console.log(`| \`${r.file.replace('frontend/modules/seedlingDemo/', '')}:${r.line}\` | \`${r.fn}\` | ${r.cls} | ${r.own ?? ''} | ${r.code ?? ''} | ${r.msg.replace(/\|/g, '\\|').replace(/`/g, "'").slice(0, 100)} |`);
}
console.log('');
console.log('totals: ' + Object.entries(totals).sort().map(([k, v]) => `${k} ${v}`).join(' · '));
