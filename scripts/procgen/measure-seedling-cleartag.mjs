#!/usr/bin/env node
/**
 * measure-seedling-cleartag — **THE `clear-tag` CENSUS** (Seedling fidelity
 * CLEARTAG, D1 + D3). Pure node: no browser, no box lock.
 *
 * ⚖ The user (2026-10-05): *"break before first use"*. The rules carry one
 * game-state event per saved obstacle flag (`flashPanel/seedlingObstacleEvents.js`),
 * and the route survey's goal for one is `clear-tag {tag, at, obstacle}`. This
 * instrument asks, for every event in the playthrough rules and every GAME
 * landing into the event's level whose box is NOT inside a solid (the open
 * side's arrivals — `fidelityArrival.gameLandings`), a fresh JS-runtime boot
 * there with the event's item, and `solveSegment` with that one goal:
 *   · `SOLVES` — ticks, the verb, the stance, the tick the flag was written;
 *   · `REFUSES` — the refusal's `obstacle.kind` / `reason` and its words.
 * A landing inside the obstacle is listed and skipped: that is the arrival the
 * flag gates, and acting from inside is never a strategy (ARRIVAL's backstop).
 *
 * USAGE: node scripts/procgen/measure-seedling-cleartag.mjs [--json] [--event=L0:1]
 */
import { argvHelp, isEntryPoint } from './argvHelp.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { atlasLevelSource } from '../../frontend/modules/seedlingDemo/levelSource.js';
import { createRunForStaging } from '../../frontend/modules/seedlingDemo/tapeRunner.js';
import { arrivalStaging, gameLandings } from '../../frontend/modules/seedlingDemo/fidelityArrival.js';
import { arrivalInsideSolid } from '../../frontend/modules/seedlingDemo/arrivalSolid.js';
import { solveSegment, SolverRefusal } from '../../frontend/modules/seedlingDemo/solverBot.js';
import { runtimeEventsOf } from '../../frontend/modules/flashPanel/seedlingPlaybackController.js';

argvHelp(import.meta.url);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAP = JSON.parse(readFileSync(join(ROOT, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const RULES = JSON.parse(readFileSync(join(ROOT, 'frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json'), 'utf8'));
const SRC = atlasLevelSource();

/**
 * The GAME inventory flags each event's action names (`FLAG_ACTIONS`' `item`),
 * as staging item properties. `hasKey` is a boss KEY, which is a key slot and
 * not an item property: staged as none, so the row reads what the run lacks.
 * The shield lock asks `ShieldLock`'s own `shieldType` (its rule is the second
 * Progressive Shield), so both shields are held.
 */
const ITEMS = Object.freeze({
    hasSword: ['hasSword'],
    hasFire: ['hasSword', 'hasFire'],
    hasWand: ['hasWand'],
    hasKey: [],
    null: [],
});
const SHIELD_ITEMS = ['hasShield', 'hasDarkShield'];

const args = process.argv.slice(2);
const json = args.includes('--json');
const only = args.find((a) => a.startsWith('--event='))?.slice('--event='.length) ?? null;

export function cleartagCensus({ events = runtimeEventsOf(RULES).events, filter = null } = {}) {
    const rows = [];
    for (const e of events) {
        const o = e.obstacle;
        if (filter && filter !== `L${o.level}:${o.tag}`) continue;
        const goal = { kind: 'clear-tag', tag: { level: o.level, tag: o.tag }, at: { x: o.x, y: o.y },
            obstacle: `${o.class}@${o.x},${o.y}` };
        const items = o.class.startsWith('shieldlock') ? SHIELD_ITEMS : ITEMS[String(e.action?.item ?? null)] ?? [];
        for (const landing of gameLandings(MAP).filter((l) => l.level === o.level)) {
            const where = `L${landing.from} ${landing.door} -> (${landing.x},${landing.y})`;
            const boot = { level: landing.level, x: landing.x, y: landing.y };
            let run;
            const st = arrivalStaging(boot, { items });
            const staging = e.action?.item === 'hasKey'
                ? { ...st, save: { totem_parts: [], seal_parts: [], ...(st.save ?? {}), keys: [0, 1, 2, 3, 4] } } : st;
            try { run = createRunForStaging(staging, SRC); } catch (err) {
                rows.push({ event: e.eventId, where, verdict: 'BOOT-FAIL', why: String(err.message).slice(0, 160) });
                continue;
            }
            const inside = arrivalInsideSolid(run);
            if (inside) {
                rows.push({ event: e.eventId, where, verdict: 'INSIDE', why: `the landing is inside ${(inside.solids ?? []).map((q) => (typeof q === 'string' ? q : q.id ?? JSON.stringify(q))).join(', ')} `
                    + '(the arrival the flag gates; never acted from)' });
                continue;
            }
            const t0 = Date.now();
            try {
                const out = solveSegment({ run, goals: [goal], name: `cleartag-${o.level}-${o.tag}`, boot });
                const rec = out.records.find((r) => r.goal === 'clear-tag');
                rows.push({ event: e.eventId, where, verdict: 'SOLVES', ticks: out.perTick.length,
                    arm: rec.arm, verb: rec.strategy ?? null, stance: rec.stance ?? null,
                    ledgerAt: rec.ledgerAt, confirmedAt: rec.confirmedAt, by: rec.by, ms: Date.now() - t0, items });
            } catch (err) {
                if (!(err instanceof SolverRefusal)) {
                    rows.push({ event: e.eventId, where, verdict: 'THREW', why: String(err.message).slice(0, 300), items });
                    continue;
                }
                rows.push({ event: e.eventId, where, verdict: 'REFUSES', kind: err.obstacle?.kind ?? null,
                    reason: err.obstacle?.reason ?? null, why: String(err.message).slice(0, 400),
                    ticks: err.perTick?.length ?? null, ms: Date.now() - t0, items });
            }
        }
    }
    return rows;
}

if (isEntryPoint(import.meta.url)) {
    const rows = cleartagCensus({ filter: only });
    if (json) {
        process.stdout.write(`${JSON.stringify({ source: 'measure-seedling-cleartag.mjs', rows }, null, 1)}\n`);
    } else {
        for (const r of rows) {
            const tail = r.verdict === 'SOLVES'
                ? `${r.ticks} t, ${r.arm}${r.verb ? ` ${r.verb}` : ''}${r.stance ? ` from (${r.stance.x},${r.stance.y})` : ''}, ledger row t${r.ledgerAt}, the write confirmed by t${r.confirmedAt} (${r.by})`
                : r.verdict === 'REFUSES' ? `${r.kind}/${r.reason ?? '-'} — ${r.why}` : r.why;
            console.log(`${r.event}  ${r.where.padEnd(40)} ${r.verdict.padEnd(8)} ${tail}`);
        }
        const by = (v) => rows.filter((r) => r.verdict === v).length;
        console.log(`\n${rows.length} rows: ${by('SOLVES')} SOLVES · ${by('REFUSES')} REFUSES · ${by('INSIDE')} INSIDE · `
            + `${by('THREW')} THREW · ${by('BOOT-FAIL')} BOOT-FAIL`);
    }
}
