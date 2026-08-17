#!/usr/bin/env node
/**
 * census-seedling-doors-elements — **DO THE TWO ROOM-AWARE DOOR ELEMENTS FIT A
 * 10x10 SEEDLING ROOM, AND WHERE DO THEY REFUSE?** — PROCGEN ELEMENTS arc 3,
 * slice 4a, D4's first arm.
 *
 * ⛔ ALL GEOMETRY, NO SOLVE, a few seconds — slice 3's `census-seedling-
 * elements.mjs` shape, one element phase over. Kinds x seeds x element, counted
 * BY NAME, through `seedlingModel` itself so the DRAWN arm is what generation
 * really produces rather than a prototype that picks its own door.
 *
 * ── THREE ARMS ────────────────────────────────────────────────────────
 *
 *   DRAWN     — `seedlingModel({elements})`: placed, or the graded refusal.
 *   OFFERED   — how many door cells the room offered the element BEFORE its one
 *               `pick` (`cost.candidates`). ⛓ This is what says whether the
 *               draw was a CHOICE or a formality; a room with one candidate
 *               places deterministically and the census should not read that as
 *               a distribution (trap 269's shape).
 *   POCKETS   — the kill gate only: how many placements took an OPEN pocket
 *               (>= 2 floor neighbours) against a ONE-neighbour nub, with the
 *               preference ON and OFF. ⚠ §9b.3 measured 79% of the corridor
 *               kill lock's `swing … collideLine("Solid")` throws at a
 *               one-neighbour nub — a PRE-EXISTING solver class, ⛔ not this
 *               slice's to fix — so the arm says how much of it the preference
 *               can avoid by construction, and the yield table says whether it
 *               did.
 *
 * Run:
 *   node scripts/procgen/census-seedling-doors-elements.mjs
 *   node scripts/procgen/census-seedling-doors-elements.mjs --kinds=winding --seeds=6
 *   node scripts/procgen/census-seedling-doors-elements.mjs --json=/tmp/census.json
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const M = (p) => import(join(REPO, 'frontend/modules', p));

const { SEEDLING_DEFAULTS, seedlingModel } = await M('seedlingDemo/procgenSeedling.js');
const { parseSkeleton } = await M('procgenCore/skeletonKinds.js');
const { buildKillGate } = await M('procgenCore/elements/killGate.js');

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`)
    .slice(`--${n}=`.length);
const KINDS = arg('kinds', 'empty,winding,branchy,bushy,loopy,open,rooms,rooms;minRoom=4,'
    + 'winding;chambers=2,loopy;chambers=2').split(',').filter(Boolean);
const SEEDS = (() => {
    const spec = arg('seeds', '12');
    if (/^\d+$/.test(spec)) {
        const out = [];
        for (let s = 1; s <= Number(spec); s += 1) out.push(s);
        return out;
    }
    return spec.split(',').map(Number);
})();
const ELEMENTS = arg('elements', 'killgate,blockpocket').split(',').filter(Boolean);
const JSON_OUT = arg('json', '');

const rows = [];
for (const kind of KINDS) {
    const skeleton = parseSkeleton(kind, { simulator: false, substrate: 'the door census' });
    for (const name of ELEMENTS) {
        const row = { kind, element: name, seeds: SEEDS.length,
            drawn: {}, offered: [], wall: [], carved: [], push: [],
            pocketOpen: 0, pocketNub: 0, pocketOpenNoPref: 0, pocketNubNoPref: 0 };
        for (const seed of SEEDS) {
            const mod = seedlingModel({ seed, skeleton, elements: { name } });
            const key = mod.elements.ran ? 'PLACED' : mod.elements.refused.reason;
            row.drawn[key] = (row.drawn[key] ?? 0) + 1;
            if (!mod.elements.ran) continue;
            const p = mod.elements.placed[0];
            row.offered.push(p.cost.candidates);
            row.wall.push(p.cost.wall);
            row.carved.push(p.cost.carved);
            if (p.cost.push !== undefined) row.push.push(p.cost.push);
            if (name !== 'killgate') continue;
            /**
             * ⛓ THE POCKET ARM RUNS THE ELEMENT'S OWN BUILDER TWICE — once with
             * the preference and once without — rather than a second copy of
             * the search. ⛔ It reads the FIRST candidate of each list rather
             * than the drawn one, because the two arms' lists are the same list
             * in the same order and only the pocket differs; comparing drawn
             * cells would compare two draws instead of two policies.
             */
            const bare = seedlingModel({ seed, skeleton });
            const probe = bare.roomProbe();
            for (const [pref, on, off] of [[true, 'pocketOpen', 'pocketNub'],
                [false, 'pocketOpenNoPref', 'pocketNubNoPref']]) {
                const built = buildKillGate(probe, { preferOpen: pref });
                if (built.refused) continue;
                for (const c of built.candidates) {
                    row[c.pocket.neighbours >= 2 ? on : off] += 1;
                }
            }
        }
        rows.push(row);
    }
}

const say = (l) => process.stdout.write(`${l}\n`);
const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `\`${k}\` ${v}`).join(' · ') || '—';
const range = (a) => (a.length ? `${Math.min(...a)}..${Math.max(...a)}` : '—');
const sum = (a) => a.reduce((x, y) => x + y, 0);

say('# THE ROOM-AWARE DOOR ELEMENTS CENSUS — geometry only, no solve');
say('');
say(`room ${SEEDLING_DEFAULTS.width}x${SEEDLING_DEFAULTS.height} · start `
    + `(${SEEDLING_DEFAULTS.start.tx},${SEEDLING_DEFAULTS.start.ty}) · `
    + `${KINDS.length} kind(s) x ${SEEDS.length} seed(s) x [${ELEMENTS.join(', ')}]`);
say('');
say('| kind | element | PLACED | door cells OFFERED | wall grown | carved | push | outcomes |');
say('|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    say(`| ${r.kind} | ${r.element} | **${r.drawn.PLACED ?? 0}**/${r.seeds} `
        + `| ${range(r.offered)} | ${range(r.wall)} | ${sum(r.carved)} `
        + `| ${range(r.push)} | ${fmt(r.drawn)} |`);
}
say('');
const total = (pick) => {
    const acc = {};
    for (const r of rows) for (const [k, n] of Object.entries(pick(r))) acc[k] = (acc[k] ?? 0) + n;
    return acc;
};
say('## rolled up over every cell');
say('');
for (const name of ELEMENTS) {
    const mine = rows.filter((r) => r.element === name);
    const acc = {};
    for (const r of mine) for (const [k, n] of Object.entries(r.drawn)) acc[k] = (acc[k] ?? 0) + n;
    say(`**${name}**: ${fmt(acc)}`);
    say('');
}
const kg = rows.filter((r) => r.element === 'killgate');
if (kg.length) {
    const on = sum(kg.map((r) => r.pocketOpen));
    const nub = sum(kg.map((r) => r.pocketNub));
    say(`## the POCKET arm (kill gate) — over every CANDIDATE of every placing seed`);
    say('');
    say(`preference ON : open (>=2 floor neighbours) **${on}** · one-neighbour nub **${nub}**`);
    say(`preference OFF: open **${sum(kg.map((r) => r.pocketOpenNoPref))}** · nub `
        + `**${sum(kg.map((r) => r.pocketNubNoPref))}**`);
    say('');
    say('⚠ The two rows are the same candidate list scored two ways: the preference only '
        + 'reorders WITHIN a candidate, so a difference here is the number of candidates '
        + 'where the room offered BOTH kinds of pocket and the policy decided which.');
}
say('');
say('⛓ **the elements DRAW nothing their room decides**: the only draw either spends is ONE '
    + '`pick` over the door cells OFFERED, and that column is what says whether the draw was '
    + 'a choice — a room offering 1 places deterministically, and reading that as a '
    + 'distribution would be trap 269.');
say('');
say(`⛓ every outcome, both elements: ${fmt(total((r) => r.drawn))}`);

if (JSON_OUT) {
    mkdirSync(dirname(JSON_OUT), { recursive: true });
    writeFileSync(JSON_OUT, `${JSON.stringify({ kinds: KINDS, seeds: SEEDS,
        elements: ELEMENTS, rows }, null, 1)}\n`);
    process.stderr.write(`[stderr] wrote ${JSON_OUT}\n`);
}
