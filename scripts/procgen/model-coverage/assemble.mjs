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

export const FAMILIES = [
    // [id, owner, regex over the refusal, phrase to locate the site]
    ['TIMEOUT', 'MODEL (solver budget)', null, null],
    ['NO-ARRIVAL/NO-EDGE', 'RULES (route derivation)', null, null],
    ['KILL-NO-WEAPON', 'MODEL (verb: a kill without a weapon)', /kill work order has no weapon/, 'the kill work order has no weapon'],
    ['KEY-NOT-HELD', 'RULES/SURVEY (the leg inventory lacks a key the room needs)', /needs a key this run does not hold/, 'needs a key this run does not hold'],
    ['PICKUP-IN-SOLID', 'MODEL (a placement inside a solid)', /placement is INSIDE solid/, 'the placement is INSIDE'],
    ['COMBAT-LADDER-EXHAUSTED', 'MODEL (ENCOUNTER: no rung clears the danger)', /combat ladder is EXHAUSTED/, 'the combat ladder is EXHAUSTED'],
    ['DANGER-MAP-FORBIDS', 'MODEL (ENCOUNTER: an armed lane / hazard forbids the cell)', /danger map forbids/, 'the danger map forbids'],
    ['CHEST-STANCE-LOOP', 'MODEL (VERB: the chest-open stance never lands)', /chest stance \(chest@[^)]*\) -> chest stance/, 'chest stance'],
    ['STANCE-UNREACHABLE', 'MODEL (corridor: no reachable stance for a verb)', /no REACHABLE stance/, 'no REACHABLE stance'],
    ['CORRIDOR:wandlock', 'MODEL (VERB-MISSING: the wand opener)', /Obstacle: solid:wandlock/, 'no corridor for goal'],
    ['CORRIDOR:pushable', 'MODEL (VERB-MISSING: fire/spear push or glide geometry)', /Obstacle: solid:pushableblock/, 'no corridor for goal'],
    ['CORRIDOR:button', 'MODEL (a trap button the planner skirts)', /Obstacle: proximity-hazard:button/, 'no corridor for goal'],
    ['CORRIDOR:pickup-obstacle', 'MODEL (a pickup treated as an obstacle)', /Obstacle: pickup:/, 'no corridor for goal'],
    ['CORRIDOR:other', 'MODEL (corridor stall)', /no corridor|corridor failed/, 'no corridor for goal'],
    ['SEALED', 'MODEL/RULES (a sealed door or cell)', /SEALED|sealed/, 'SEALED'],
];
const srcFiles = ['frontend/modules/seedlingDemo'].flatMap((d) => readdirSync(join(REPO, d)).filter((f) => f.endsWith('.js') && !f.includes('.test.')).map((f) => join(d, f)));
const srcText = Object.fromEntries(srcFiles.map((f) => [f, readFileSync(join(REPO, f), 'utf8').split('\n')]));
const siteOf = (phrase) => {
    if (!phrase) return [];
    const out = [];
    for (const [f, lines] of Object.entries(srcText)) lines.forEach((l, i) => { if (l.includes(phrase) && !/^\s*(\*|\/\/)/.test(l)) out.push(`${f.split('/').pop()}:${i + 1}`); });
    return out.slice(0, 8);
};

const survey = rd('survey-end.json');
const rows = survey?.rows ?? [];
const fam = new Map();
const claim = (id, r) => { if (!fam.has(id)) fam.set(id, []); fam.get(id).push(r); };
for (const r of rows) {
    if (r.verdict === 'SOLVED') continue;
    const msg = String(r.refusal ?? r.error ?? r.why ?? '');
    if (r.verdict === 'TIMEOUT' || r.verdict === 'CRASHED') { claim('TIMEOUT', r); continue; }
    if (/NO-ARRIVAL|NO-EDGE/.test(r.verdict)) { claim('NO-ARRIVAL/NO-EDGE', r); continue; }
    const f = FAMILIES.find(([, , re]) => re && re.test(msg));
    claim(f ? f[0] : 'UNCLASSIFIED', r);
}
const families = [...fam.entries()].map(([id, rs]) => {
    const def = FAMILIES.find((f) => f[0] === id);
    return {
        family: id, owner: def?.[1] ?? 'UNCLASSIFIED', steps: rs.length,
        rooms: [...new Set(rs.map((r) => r.level))].sort((a, b) => a - b),
        site: siteOf(def?.[3]),
        rows: rs.map((r) => ({ step: r.step, level: r.level, verdict: r.verdict, boot: r.boot?.kind ?? r.bootKind ?? r.boot ?? null,
            refusal: String(r.refusal ?? r.error ?? '').slice(0, 600) })),
    };
}).sort((a, b) => b.steps - a.steps);
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
for (const f of families) console.log(`${f.family} [${f.owner}] ${f.steps} steps, rooms ${f.rooms.join(',')} site ${f.site.slice(0, 3).join(' ')}`);
