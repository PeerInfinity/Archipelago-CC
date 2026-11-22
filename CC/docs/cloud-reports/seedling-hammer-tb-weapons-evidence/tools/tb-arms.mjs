#!/usr/bin/env node
// rules-deterministic-boss-draws — L57 under the proposed patterns, on the SCRATCH model copy
// (`frontend/modules/$SEEDLING_DEMO_DIR`, default `seedlingDemoDet`: `tentacleBeast.js` with `DetTentacleStream`).
// For each committed L57 staging (the witnesses' own boots/persistence/save), and each arm (sword | spear), solve
// clear-tag {57,0} + the mouth with the solver's own verb (the hitless-first fork, as shipped), and print hits,
// ticks, the chosen variant and the end level. The seed is IRRELEVANT under the patterns: every arm is run on two
// different seeds and the per-tick keys must be identical (the learnability check).
//   DET_TB=pat=halton|hash [DET_HASH=jiggle|mix] node tb-arms.mjs [--arms=sword,spear] [--out=<json>]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const R = process.cwd();
const D = join(R, 'frontend/modules', process.env.SEEDLING_DEMO_DIR || 'seedlingDemoDet');
const M = (f) => import(join(D, f));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const { atlasLevelSource } = await M('levelSource.js');
const { parseTape, appendInventorySlots, INVENTORY_ITEM_IDS } = await M('tapeFormat.js');
const { createRunForStaging, stagingFromTape } = await M('tapeRunner.js');
const { withContactFidelity } = await M('contactFidelity.js');
const { solveSegment } = await M('solverBot.js');
const SRC = atlasLevelSource();
const W = join(D, 'fixtures/tentaclebeast-witness');
const goals = [
    { kind: 'clear-tag', tag: { level: 57, tag: 0 }, at: { x: 80, y: 48 }, obstacle: 'tentaclebeast@80,48' },
    { kind: 'reach-exit', exit: { x: 96, y: 64 } },
];
const ARMS = arg('arms', 'sword,spear').split(',');
const STAGINGS = arg('stagings', 'tb-hitless-pit,tb-hitless-door,tb-hitless-s2').split(',');
const items = (arm, base) => ({ ...base, hasSword: arm === 'sword', hasSpear: arm === 'spear', hasWand: arm === 'wand' });
// TB-WEAPONS: equip the ARM's own slot (the rules tool equipped slot 0, which with hasFire in the bag is the FIRE).
const slotOf = (arm, it) => appendInventorySlots([], it).slots.indexOf(INVENTORY_ITEM_IDS[arm]);
const SEEDS = (process.env.TB_SEEDS || '').split(',').filter(Boolean).map(Number);
// TB-WEAPONS: `--tapes=<dir>` writes each solved plan as a tape (the staging + the plan's keys as spans + its equips).
const TAPES = arg('tapes');
const spansOf = (perTick) => {
    const spans = []; const open = new Map();
    perTick.forEach((keys, t) => {
        for (const [k, from] of open) if (!keys.has(k)) { spans.push({ key: k, from, to: t }); open.delete(k); }
        for (const k of keys) if (!open.has(k)) open.set(k, t);
    });
    for (const [k, from] of open) spans.push({ key: k, from, to: perTick.length });
    return spans.sort((a, b) => a.from - b.from || a.key.localeCompare(b.key));
};
const rows = [];
for (const name of STAGINGS) {
    const w = JSON.parse(readFileSync(join(W, `${name}.json`), 'utf8'));
    for (const arm of ARMS) {
        const per = [];
        for (const seed of (SEEDS.length ? SEEDS : [w.tape.rng.seed, 7])) {
            const tape = { ...w.tape, rng: { ...w.tape.rng, seed }, seam: { ...w.tape.seam, items: items(arm, w.tape.seam.items) },
                equips: process.env.TB_RULES_EQUIP ? (arm === 'sword' ? w.tape.equips : [{ t: 0, slot: 0 }]) : (arm === 'sword' ? w.tape.equips : [{ t: 0, slot: slotOf(arm, items(arm, w.tape.seam.items)) }]), inputs: [], tick_count: 0 };
            const t0 = Date.now();
            let row;
            try {
                row = withContactFidelity({ tentacleBeastFight: true, tentacleHitlessFirst: true }, () => {
                    const staging = stagingFromTape(parseTape(JSON.stringify(tape)));
                    const run = createRunForStaging(staging, SRC);
                    const out = solveSegment({ run, goals, name: `${name}-${arm}`, boot: staging.boot,
                        forkRun: () => createRunForStaging(staging, SRC) });
                    const rec = out.records.find((r) => r.verb === 'tentaclebeast');
                    if (TAPES) {
                        mkdirSync(TAPES, { recursive: true });
                        const planned = { ...tape, name: `${name}-${arm}-s${seed}`, inputs: spansOf(out.perTick),
                            equips: [...(tape.equips ?? []), ...(out.equips ?? [])], tick_count: out.perTick.length };
                        writeFileSync(join(TAPES, `${name}-${arm}-s${seed}.json`), `${JSON.stringify(planned, null, 1)}\n`);
                    }
                    const weapons = [...new Set((run.ledger('presses') ?? []).map((q) => q.weapon))];
                    const hits = (run.ledger('playerHits') ?? []).map((h) => `${h.t}:${h.source}`);
                    return { ok: true, level: run.level, ticks: out.perTick.length, hits, deaths: run.playerDeaths.length, weapons,
                        cleared: run.earnedClears.map((c) => `${c.level}:${c.tag}`), choice: rec?.choice ?? null,
                        tried: rec?.tried?.map((t) => ({ ok: t.ok, hits: t.hits, spent: t.spent, why: t.why })) ?? null,
                        keys: out.perTick.map((k) => [...k].sort().join('+')) };
                });
            } catch (e) { row = { ok: false, error: String(e?.message ?? e).slice(0, 1200) }; }
            row.ms = Date.now() - t0;
            per.push({ seed, ...row });
        }
        const same = per.every((p) => p.ok) && JSON.stringify(per[0].keys) === JSON.stringify(per[1].keys);
        const r = { staging: name, arm, seeds: per.map((p) => p.seed), sameOnBothSeeds: same,
            ...Object.fromEntries(Object.entries(per[0]).filter(([k]) => k !== 'keys')), keyHash: per[0].keys ? per[0].keys.join('|').length : null };
        rows.push({ ...r, keys: per[0].keys ?? null, perSeed: per.map(({ keys, tried, ...q }) => q) });
        console.log('  per-seed', JSON.stringify(per.map((q) => [q.seed, q.ok, q.ticks, q.hits, q.deaths, q.level, q.choice?.variant, q.error?.slice(0, 200)])));
        console.log(JSON.stringify({ ...r, tried: undefined }));
    }
}
if (arg('out')) writeFileSync(arg('out'), `${JSON.stringify({ knobs: process.env.DET_TB || 'pat=halton', hash: process.env.DET_HASH || 'jiggle', rows }, null, 1)}\n`);
