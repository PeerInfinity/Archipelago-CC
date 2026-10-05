#!/usr/bin/env node
/**
 * assemble — MEASURE ONLY (slice rules-model-coverage-inventory, 2026-10-05).
 * Joins the probe outputs into ONE coverage JSON, and classifies the route survey's non-SOLVED rows into
 * cause FAMILIES. A family is a regex over the row's own refusal text; its SITE is found, not typed: the
 * family's `phrase` is searched (fixed string) in the model's non-test sources and every file:line is cited.
 * A row no family claims lands in UNCLASSIFIED (never silently dropped).
 *
 *   node scripts/procgen/model-coverage/assemble.mjs --dir=<probe dir> --sha=<main sha> --out=<coverage.json>
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d ?? ''}`).split('=').slice(1).join('=');
const DIR = arg('dir');
const rd = (f) => (existsSync(join(DIR, f)) ? JSON.parse(readFileSync(join(DIR, f), 'utf8')) : null);

// The survey stamps its OWN family on every row (`row.family`, "<FAMILY> — <why>"); that is the PRIMARY key.
// The SUB-family is extracted here: the obstacle for a VERB-* row, the danger source for a LADDER row, and a
// named cause for an "unclassified" row (the regexes below; anything they miss stays "unclassified:other").
export const UNCLASSIFIED_CAUSES = [
    // [sub-family, owner, regex, phrase that locates the site in the model]
    ['kill-no-weapon:no-live-spinner', 'MODEL (a kill-lock room whose bodies the run does not track)', /kill work order has no weapon — level \d+ tracks NO live spinner/, 'tracks NO live spinner'],
    ['kill-no-weapon', 'MODEL (a kill with no weapon cell/tick)', /kill work order has no weapon/, 'the kill work order has no weapon'],
    ['keylock-sub-order', 'MODEL (the key is a sub-order the planner does not chain)', /needs a key this run does not hold/, 'needs a key this run does not hold'],
    ['keylock-stance-loop', 'MODEL (VERB: the keylock stance never lands)', /keylock stance \(bosslock@[^)]*\) -> keylock stance/, '} stance (${blocker.id})'],
    ['chest-stance-loop', 'MODEL (VERB: the chest-open stance never lands)', /chest stance \(chest@[^)]*\) -> chest stance/, '} stance (${blocker.id})'],
    ['button-stance-unreachable', 'MODEL (corridor to a button stance)', /no REACHABLE stance inside button/, 'no REACHABLE stance inside'],
    ['swing-stance-unreachable', 'MODEL (corridor to a swing stance)', /no REACHABLE stance for a swing/, 'no REACHABLE stance for a swing'],
    ['danger-map:armed-arrow-lane', 'MODEL (ENCOUNTER: an armed arrow lane blocks the only corridor)', /danger map forbids .*arrowLane/, 'the danger map forbids'],
    ['replanned-corridor-failed', 'MODEL (corridor stall: a waypoint not reached)', /re-planned corridor failed too/, 'the re-planned corridor failed too'],
    ['collect-stance-no-corridor', 'MODEL (corridor to a pickup stance)', /ladder-routed: no corridor from/, 'ladder-routed'],
    ['press-on-frozen-tick', 'MODEL (a press during a pickup ceremony refused)', /FROZEN tick/, 'FROZEN tick'],
    ['ghostsword-press', 'MODEL (ghostsword slash arm not modelled)', /ghostsword press/, 'ghostsword press'],
    ['door-on-pit', 'MODEL (a coincidence refusal: door and pit fire in one tick)', /stands ON a PIT tile/, 'a PIT tile (${tx},${ty})'],
    ['walk-stall-at-pickup', 'MODEL (walked at a pickup and stalled)', /without touching it; stalled/, 'without touching it'],
];
const srcFiles = ['frontend/modules/seedlingDemo'].flatMap((d) => readdirSync(join(REPO, d)).filter((f) => f.endsWith('.js') && !f.includes('.test.') && !f.startsWith('procgen')).map((f) => join(d, f)))
    .concat(['scripts/procgen/survey-seedling-route.mjs']);
const srcText = Object.fromEntries(srcFiles.map((f) => [f, readFileSync(join(REPO, f), 'utf8').split('\n')]));
const siteOf = (phrase) => {
    if (!phrase) return [];
    const out = [];
    for (const [f, lines] of Object.entries(srcText)) lines.forEach((l, i) => { if (l.includes(phrase) && !/^\s*(\*|\/\/)/.test(l)) out.push(`${f.split('/').pop()}:${i + 1}`); });
    return out.slice(0, 8);
};

const survey = rd('survey-end.json');
const rows = survey?.rows ?? [];
const PRIMARY_OWNER = {
    'VERB-MISSING': 'MODEL (no strategy row for the obstacle)',
    'VERB-SELECTED-NOT-REGISTERED': 'MODEL (the table names a verb with no executor)',
    'VERB-APPLY': 'MODEL (a registered verb did not apply)',
    LADDER: 'MODEL (ENCOUNTER: every combat-ladder rung refused the danger)',
    'ENCOUNTER-UNMODELLED': 'MODEL (a fight the model does not simulate)',
    'ITEM-GATE': 'RULES/SURVEY (the obstacle is item-gated and the leg inventory lacks it)',
    TIMEOUT: 'MODEL (solver budget; no verdict)',
};
const fam = new Map();
const claim = (id, sub, owner, phrase, r) => {
    const k = `${id}|${sub}`;
    if (!fam.has(k)) fam.set(k, { id, sub, owner, phrase, rows: [] });
    fam.get(k).rows.push(r);
};
for (const r of rows) {
    if (r.verdict === 'SOLVED') continue;
    const msg = String(r.refusal ?? r.error ?? r.why ?? '');
    if (r.verdict === 'TIMEOUT' || r.verdict === 'CRASHED') { claim('TIMEOUT', '-', PRIMARY_OWNER.TIMEOUT, null, r); continue; }
    const id = String(r.family ?? 'unclassified').split(' — ')[0].trim();
    if (id === 'unclassified') {
        const c = UNCLASSIFIED_CAUSES.find(([, , re]) => re.test(msg));
        if (c) claim('unclassified', c[0], c[1], c[3], r); else claim('unclassified', 'other', 'UNCLASSIFIED', null, r);
        continue;
    }
    let sub = '-';
    const ob = msg.match(/Obstacle: ([a-z-]+:[a-z0-9]+|no-corridor)/);
    const danger = msg.match(/danger at \([^)]*\) — ((?:enemy|hazard):[a-z0-9]+)/);
    const verb = String(r.family).match(/names '(\w+)'/);
    if (ob) sub = ob[1]; else if (danger) sub = danger[1]; else if (verb) sub = `verb:${verb[1]}`;
    else if (/INSIDE solid/.test(msg)) sub = 'pickup-inside-solid';
    else if (/ladder-routed/.test(msg)) sub = 'collect-stance-no-corridor';
    else if (/touch stance/.test(msg)) sub = 'touch-stance';
    else if (/breakablerock/.test(msg)) sub = (msg.match(/(breakablerock\w*)@/) ?? [])[1] ?? '-';
    claim(id, sub, PRIMARY_OWNER[id] ?? id, id === 'LADDER' ? 'the combat ladder is EXHAUSTED' : (id === 'VERB-APPLY' ? 'failed to apply' : /^VERB/.test(id) ? 'No strategy row exists' : null), r);
}
const families = [...fam.values()].map(({ id, sub, owner, phrase, rows: rs }) => {
    return {
        family: id, sub, owner, steps: rs.length,
        rooms: [...new Set(rs.map((r) => Number(r.level)))].sort((a, b) => a - b),
        site: siteOf(phrase),
        rows: rs.map((r) => ({ step: r.step, level: r.level, verdict: r.verdict, family: r.family ?? null, boot: r.boot?.kind ?? null,
            refusal: String(r.refusal ?? r.error ?? '').slice(0, 600) })),
    };
}).sort((a, b) => a.family.localeCompare(b.family) || b.steps - a.steps);
const verdicts = {}; for (const r of rows) verdicts[r.verdict] = (verdicts[r.verdict] ?? 0) + 1;

const out = {
    slice: 'rules-model-coverage-inventory', measuredAt: new Date().toISOString(), mainSha: arg('sha'),
    scripts: 'scripts/procgen/model-coverage/ on branch rules-model-coverage-inventory',
    c_entityClasses: rd('classes.json'),
    c_i1TextDiff: rd('i1-diff.json'),
    probes: {
        rooms: (() => { const p = rd('probe-rooms.json'); if (!p) return null; const runs = p.rooms.flatMap((r) => r.runs.map((x) => ({ level: r.level, ...x })));
            return { ticks: p.ticks, rooms: p.rooms.length, buildRefusedAtFullRoles: p.rooms.filter((r) => r.buildRefusals.length).map((r) => r.level), runs: runs.length,
                refused: runs.filter((x) => !x.ok), dying: runs.filter((x) => x.deaths).map((x) => ({ level: x.level, from: x.from, x: x.x, y: x.y, items: x.items, death: x.firstDeath })) }; })(),
        persistence: (() => { const p = rd('probe-persistence.json'); if (!p) return null; return { chainEnd: p.chainEnd, m1: { offered: p.m1.offered, refused: p.m1.refusedCount, rows: p.m1.refused }, m2: { slots: p.m2.slots, boot: p.m2.boot, refused: p.m2.refused }, m3: { buildRefused: p.m3.filter((r) => r.build !== 'ok'), runRefused: p.m3.filter((r) => r.run && r.run !== 'ok') } }; })(),
        arrivals: (() => { const p = rd('probe-arrivals.json'); if (!p) return null; const { rows: rr, ...head } = p; return { ...head, dying: rr.filter((r) => r.none.deaths || r.all.deaths || r.none.refusal || r.all.refusal) }; })(),
        footprint: rd('footprint.json'),
    },
    a_survey: { verdicts, steps: rows.length, families },
    b_softlocks: { main: rd('soft-main.json'), mainWarp: rd('soft-main-warp.json'), reclosingLocks: rd('soft-rl.json'), reclosingLocksWarp: rd('soft-rl-warp.json') },
};
writeFileSync(arg('out'), JSON.stringify(out, null, 1));
console.log('survey verdicts', verdicts);
for (const f of families) console.log(`${f.family} / ${f.sub} [${f.owner}] ${f.steps} steps, rooms ${f.rooms.join(',')} site ${f.site.slice(0, 3).join(' ')}`);
