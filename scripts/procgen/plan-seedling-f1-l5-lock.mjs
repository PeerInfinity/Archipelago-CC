#!/usr/bin/env node
/**
 * plan-seedling-f1-l5-lock — ⛓⛓⛓ SEEDLING FIDELITY F1: L5's KILL LOCK, ASKED
 * OF THE GAME WITH A WALK THAT CAN TELL THE TWO READINGS APART.
 *
 * Swim R5 D3 could not ask this. L5's bodies left the game at t54 of
 * `r8-solve-5` (the arrows' update order — `levelRun.arrowUpdateOrder`), so
 * the model's kill tick was not the game's, and its witness reached the lock
 * after both predictions. With the order transcribed, the model's bodies are
 * the game's to the bit over the whole tape: the third bob dies to the
 * ceiling at t166, is destroyed at t190 and leaves the world at t201.
 *
 * The two readings of `Lock`'s opening then predict different ticks:
 *
 *   KILL     `chaserKillLockOpens[].t` (the death STARTS, t166) + 101 = 267.
 *            This is what `twoPassSolve` declares today.
 *   REMOVAL  `Game.totalEnemies()` is `classCount(Bob) + …`, and a dying
 *            Bob is in the world until `FP.world.remove` — t201. The lock's
 *            100 alpha steps run after that.
 *
 * This tape replays `r8-solve-5`'s staging and its keys through t199 (the
 * kills; the player parks at (56.05, 56.40) from t57), then the segment's own
 * walk to the lock (its keys from t462) shifted to start at t167, then `down`
 * against the lock. The player stands on the lock from about t261, before
 * BOTH readings, so the tick it crosses names the opening.
 *
 * ⛓ MEASURED ON THE GAME (recorded headless): the player crosses to L6 on
 * t303. The model crosses on t269 with `{5,0}@267` (the kill reading) and on
 * t303 with `{5,0}@301` = the removal (t201) + 100. So the declaration this
 * tape carries is GAME-SOURCED, 301, and the model agrees with the recording
 * under it. ⛔ The model's own prediction (267) does not — the ledger's tick is
 * the kill's, 34 ticks early. That is swim R5's residue item 3, measured, and
 * it is not changed here.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-f1-l5-lock.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-f1-l5-lock.mjs --check    # exit 1 on drift
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

const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));

const NAME = 'f1-l5-lock-removal';
/** The kills are done by t166 and the third body is gone at t201. */
const CUT = 199;
/** `r8-solve-5`'s own walk to the lock begins at t462; it starts here instead. */
const WALK_FROM = 462;
const START = 167;
const TICKS = 380;
/** ⛓ GAME-SOURCED: the crossing on t303 (see the header). */
const DECLARED = 301;
/** `Lock.activationStep`'s 100 alpha steps after the count reads zero. */
const AFTER_REMOVAL = 100;
const KILL_FADE = 101;

let failures = 0;
const check = (name, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
};

const base = loadTape('r8-solve-5');
const shift = START - WALK_FROM;
const inputs = [];
for (const k of base.inputs) {
    if (k.to <= CUT) inputs.push({ key: k.key, from: k.from, to: k.to });
    else if (k.from >= WALK_FROM) {
        inputs.push({ key: k.key, from: k.from + shift, to: Math.min(k.to + shift, TICKS) });
    }
}
const lastTo = Math.max(...inputs.map((k) => k.to));
inputs.push({ key: 'down', from: lastTo, to: TICKS });

const persistence = [{
    level: 5,
    tag: 0,
    note: 'GAME-sourced: the player crosses lock@48,112 on t303 in the game; the last bob '
        + 'leaves the world on t201 and the lock opens 100 alpha steps later '
        + '(scripts/procgen/plan-seedling-f1-l5-lock.mjs)',
    at: DECLARED,
}];

/** Drive the model; return the per-tick observations and the run. */
function drive(tape) {
    let run = null;
    const obs = [];
    const st = createTapeStepper(tape, {
        levelSource: atlasLevelSource(),
        onTick: (t, s, h, rn) => { run = rn; },
    });
    const removedAt = new Map();
    let r = st.next();
    while (!r.done) {
        const o = r.value.observation;
        obs.push(o);
        if (run && run.level === 5) {
            const live = new Set(run.entities('chasers').map((c) => c.id));
            for (const id of removedAt.keys()) if (!live.has(id) && removedAt.get(id) === null) removedAt.set(id, o.t);
            for (const id of live) if (!removedAt.has(id)) removedAt.set(id, null);
        }
        r = st.next();
    }
    return { obs, run, removedAt };
}

const description = '⛓⛓⛓ SEEDLING FIDELITY F1 — L5\'s KILL LOCK OPENS ON THE REMOVAL, NOT THE KILL. '
    + '`r8-solve-5`\'s staging and keys through t199 (its three bobs die to the arrows at t124, '
    + 't127 and t166; the last is destroyed at t190 and leaves the world at t201), then the '
    + 'segment\'s own walk to `lock@48,112` (its keys from t462) started at t167, then `down` '
    + 'against the lock. The player stands on the lock from about t261, before both readings: '
    + 'the kill (t166 + 101 = 267, what `twoPassSolve` declares) and the removal (t201 + 100 = '
    + '301). The game crosses to L6 on t303, which is the removal. `{5,0}@301` is GAME-sourced; '
    + 'the model replays the recording under it and its own ledger predicts 267. Authored by '
    + 'scripts/procgen/plan-seedling-f1-l5-lock.mjs.';

const tape = {
    ...base,
    name: NAME,
    persistence,
    tick_count: TICKS,
    inputs,
    description,
};
delete tape.note;

const { obs, run, removedAt } = drive(tape);
const cross = obs.find((o) => o.level !== 5);
const kills = run.chaserKillLockOpens.filter((o) => !o.nil);
const lastRemoval = Math.max(...[...removedAt.values()].filter((v) => v !== null));
check('⛓ the walk takes ZERO hits', run.playerHits.length === 0,
    JSON.stringify(run.playerHits.map((h) => ({ t: h.t, source: h.source }))));
check('⛓ the kill lock is opened by a kill in the model (the third bob, t166)',
    kills.length === 1 && kills[0].t === 166, JSON.stringify(kills.map((k) => ({ t: k.t, id: k.id }))));
check('⛓ every L5 body has left the world, the last at t201',
    [...removedAt.values()].every((v) => v !== null) && lastRemoval === 201,
    JSON.stringify(Object.fromEntries(removedAt)));
check('⛓⛓ the declaration is the removal + 100 (the game\'s crossing, t303)',
    lastRemoval + AFTER_REMOVAL === DECLARED, `${lastRemoval} + ${AFTER_REMOVAL} = ${DECLARED}`);
const arrivedAt = obs.find((o) => o.y >= 108.5)?.t ?? null;
check('⛓⛓ the walk DISCRIMINATES: the player is on the lock before the kill reading opens it',
    arrivedAt !== null && arrivedAt < kills[0].t + KILL_FADE,
    `on the lock at t${arrivedAt}; kill reading ${kills[0].t + KILL_FADE}, removal reading ${DECLARED}`);

const parsed = parseTape(tape);
const json = `${JSON.stringify({ ...parsed, description, note: '' }, null, 4)}\n`;
const path = join(TAPES, `${NAME}.json`);
if (CHECK) {
    const same = existsSync(path) && readFileSync(path, 'utf8') === json;
    check(`⛓ the committed ${NAME} is what this script produces today`, same,
        same ? 'byte-identical' : '⛔ DRIFT — re-run without --check');
} else {
    writeFileSync(path, json);
    console.log(`wrote ${path.slice(REPO.length + 1)}`);
}
console.log(`## ${NAME}: ${TICKS} ticks, on the lock t${arrivedAt}, crosses t${cross?.t ?? '?'}, `
    + `declared {5,0}@${DECLARED}`);

if (failures > 0) {
    console.error(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
console.log('\nall checks green');
