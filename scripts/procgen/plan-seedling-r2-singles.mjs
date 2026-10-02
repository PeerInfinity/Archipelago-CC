#!/usr/bin/env node
/**
 * plan-seedling-r2-singles — ⛓⛓⛓ R2-swim D3: THE CENSUS SINGLES, WITNESSED ON
 * THE GAME BEFORE THE MODEL STEP.
 *
 *   `r2-two-teleporters` (D3 b) — L113 (`End/2.oel`), boot (24,24) ⇒ the player at
 *     (32,32), straddling the seam between `teleporter@16,0` and `teleporter@32,0`
 *     (both to L114). `up` ×14: both volumes are entered on t 14.
 *     `Teleporter.update` is `FP.world = new Game(to, playerPos)`, the LAST to
 *     update wins, and `addUpdate` prepends — so the FIRST `.oel` placement,
 *     `(16,0)`, wins: arrival (72,136), not `(32,0)`'s (88,136). Then `right`
 *     ×5 (t 14–18) parks the player at x 80.75, across L114's
 *     `teleporter@64,144` / `teleporter@80,144` seam, and `down` from t 25
 *     fires both on t 31: `(64,144)` wins, arrival (24,24) in L113, not (40,24).
 *     At the base the run refuses t 14 by name ("2 teleporters fired on the
 *     same tick").
 *
 * ⛔ THE KEYS ARE A FIXED SCHEDULE and the tapes are emitted from it alone.
 * Each was recorded on the game (`check-seedling-bot-differential.mjs --record
 * --only=…`) before its model step was committed. `--check` re-derives them.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-r2-singles.mjs           (write)
 *   node scripts/procgen/plan-seedling-r2-singles.mjs --check   (compare)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MODULE = join(REPO, 'frontend', 'modules', 'seedlingDemo');
const TAPES = join(MODULE, 'fixtures', 'tapes');

const CHECK = process.argv.includes('--check');

const { parseTape, PIN_NAMES } = await import(join(MODULE, 'tapeFormat.js'));
const { createLevelRun } = await import(join(MODULE, 'levelRun.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
const { buildTape } = await import(join(MODULE, 'botDriverV1.js'));
const { ROLES } = await import(join(MODULE, 'levelWorld.js'));

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const levelSource = atlasLevelSource();
const NO_KEYS = new Set();
function stage(boot, seam) {
    return createLevelRun({
        levelSource, boot: { ...boot }, noclip: false, noHazards: [], noDamage: false,
        grants: [], persistence: [], despawn: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] }, rng: null,
        seam: structuredClone(seam), roles: ROLES,
    });
}

function tapeJson(name, boot, seam, perTick, description) {
    const folded = buildTape(perTick, boot, name,
        { noclip: false, noDamage: false, noHazards: [], grants: [] });
    const tape = {
        game: 'seedling', name, boot: { ...boot }, noclip: false, noDamage: false, noHazards: [],
        grants: [], persistence: [], equips: [], pins: [...PIN_NAMES],
        save: { totem_parts: [], keys: [], seal_parts: [] },
        rng: { seed: 1, split: false }, seam: structuredClone(seam),
        tick_count: perTick.length, inputs: folded.inputs, tape_version: 8,
    };
    const parsed = parseTape({ ...tape, description });
    return `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
}

function emit(name, json) {
    const path = join(TAPES, `${name}.json`);
    if (CHECK) {
        const same = existsSync(path) && readFileSync(path, 'utf8') === json;
        check(`⛓ the committed ${name} is what this script produces today`, same,
            same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
    } else {
        writeFileSync(path, json);
        console.log(`wrote ${path.slice(REPO.length + 1)}`);
    }
}

function drive(boot, seam, perTick) {
    const run = stage(boot, seam);
    let t = 0;
    try {
        for (const held of perTick) { run.advance(held); t += 1; }
    } catch (e) {
        return { run, refused: `t ${t + 1}: ${e.message.split('\n')[0]}` };
    }
    return { run, refused: null };
}

/** `[[from, to, keys…], …]` → one held-key set per tick. */
function schedule(n, spans) {
    return Array.from({ length: n }, (_, t) => new Set(spans
        .filter(([a, b]) => t >= a && t < b).flatMap(([, , ...k]) => k)));
}

// ── r2-two-teleporters (D3 b) ────────────────────────────────────────
{
    const NAME = 'r2-two-teleporters';
    const BOOT = Object.freeze({ level: 113, x: 24, y: 24 });
    const SEAM = Object.freeze({ items: {} });
    const perTick = schedule(60, [[0, 14, 'up'], [14, 19, 'right'], [25, 60, 'down']]);
    emit(NAME, tapeJson(NAME, BOOT, SEAM, perTick,
        'R2-swim D3(b): L113, boot (24,24) — the player at (32,32) across the seam of '
        + '`teleporter@16,0` and `teleporter@32,0` (both to L114); `up` fires both on t 14 and '
        + 'the FIRST `.oel` placement wins (it updates LAST): arrival (72,136). `right` ×5 and '
        + '`down` from t 25 fire L114\'s `teleporter@64,144` and `@80,144` together on t 31: '
        + 'arrival (24,24).'));
    const { run, refused } = drive(BOOT, SEAM, perTick);
    check(`${NAME}: the run takes all 60 ticks`, refused === null, refused ?? '');
    if (!refused) {
        const tr = run.transitions.map((x) => `${x.from_level}->${x.to_level}@${x.t}`);
        check(`${NAME}: 113->114 on t 14 and 114->113 on t 31`,
            JSON.stringify(tr) === JSON.stringify(['113->114@14', '114->113@31']), JSON.stringify(tr));
    }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
