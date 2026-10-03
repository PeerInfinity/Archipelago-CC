#!/usr/bin/env node
/**
 * plan-seedling-f1c-l18-lock — ⛓⛓⛓ SEEDLING FIDELITY F1c D2: L18's SPINNER
 * KILL LOCK, ASKED OF THE GAME WITH A WALK THAT TELLS THE TWO SPELLINGS APART.
 *
 * F1b fixed the CHASER arm's declaration to the v9 spelling, `removal +
 * opensOnTick(0.01) − 1` (= removal + 100), and witnessed it on L5
 * (`f1-l5-lock-removal`). The SPINNER arm (`execKillByPress`'s tail) still
 * declares `last.t + fade` = removal + 101, while its own scratch layer spells
 * the same moment removal + 100 (F1b residue 2). Every committed spinner walk
 * reaches `lock@144,112` LATE — `r9-solve-18` stands at (87.22, 98.39) from
 * t320 to t418 — so no replay could see the difference.
 *
 * This tape replays `r9-solve-18`'s staging and keys through t320 (both bodies
 * are dead; the last, `spinner@112,48`, leaves the world on t317), then the
 * segment's own walk to the teleporter (its keys from t418) started at t330
 * instead, then `right` to the end. The player is pressed against the lock's
 * west face from about t360, before BOTH readings:
 *
 *   v9 `removal + 100` = 417     (the chaser arm's spelling since F1b)
 *   `removal + 101`   = 418     (what the spinner arm declares today)
 *
 * and the model crosses to L19 one tick later under the second than under the
 * first. The tick the GAME crosses on names the spelling.
 *
 * ⛓ MEASURED ON THE GAME (recorded headless twice, byte-identical): the player
 * crosses to L19 on **t444** — NEITHER reading. The model crosses on t444 with
 * `{18,0}@416` = the ledger's removal (317) + **99**, and its positions match
 * the recording on every tick under it. The cause is the ledger, not only the
 * spelling: `stepSpinner` keeps an alpha-zero body one more step
 * (`removePending`), so `assertSpinnerRemovalIsDeclared` stamps it one tick
 * later than a chaser's removal is stamped for the same event — the chaser
 * convention, which `f1-l5-lock-removal` measured on L5, reads 316 here, and
 * 316 + the v9 fade (100) = 416. So the declaration this tape carries is
 * GAME-SOURCED, 416; the model's own two readings (417, 418) are refuted by
 * one and two ticks. F1c D2 STOPs at the fix (it moves the generated spinner
 * kill-lock certifications and the `r8-d2` cascade, which the brief did not
 * license); see `CC/docs/cloud-reports/seedling-fidelity-f1c.md`.
 *
 * Run:
 *   node scripts/procgen/plan-seedling-f1c-l18-lock.mjs            # write the tape
 *   node scripts/procgen/plan-seedling-f1c-l18-lock.mjs --check    # exit 1 on drift
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

// ⚠ A bare import does nothing (`check-procgen-help`'s import door): the work is `main()`'s.
async function main() {

    const { loadTape } = await import(join(MODULE, 'fixtures', 'index.js'));
    const { parseTape } = await import(join(MODULE, 'tapeFormat.js'));
    const { createTapeStepper } = await import(join(MODULE, 'tapeRunner.js'));
    const { atlasLevelSource } = await import(join(MODULE, 'levelSource.js'));
    const { RESPONDERS, opensOnTick } = await import(join(MODULE, 'activators.js'));

    const NAME = 'f1c-l18-lock-removal';
    const LEVEL = 18;
    /** Both bodies are dead and the last has left the world by here. */
    const CUT = 320;
    /** `r9-solve-18`'s own walk from the loiter cell to the teleporter begins at t418. */
    const WALK_FROM = 418;
    const START = 330;
    const TICKS = 470;
    /** The v9 spelling of the `Lock`'s fade: `opensOnTick − 1` (F1b). */
    const V9_FADE = opensOnTick(RESPONDERS.lock.fade) - 1;
    /** ⛓ GAME-SOURCED: the declaration under which the model crosses with the game. */
    const GAME_AT = 416;
    /** ⛓ GAME-SOURCED: the game's crossing to L19, recorded twice. */
    const GAME_CROSS = 444;

    let failures = 0;
    const check = (name, ok, detail) => {
        if (!ok) failures += 1;
        console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ` — ${detail}` : ''}`);
    };

    /**
     * ⛓ FIDELITY F1c — THE BASE IS THE SEGMENT AS THIS WITNESS WAS CUT FROM IT.
     * F1c's D3 re-recorded the campaign chain, so `fixtures/tapes/r9-solve-18.json`
     * is a different walk now; the witness (game-recorded) is not. The segment
     * as committed at F1b's chain is kept byte for byte in
     * `fixtures/witness-bases/` (outside the tape roster) for this script.
     */
    const base = parseTape(readFileSync(join(MODULE, 'fixtures', 'witness-bases', 'r9-solve-18.f1b.json'), 'utf8'));
    const shift = START - WALK_FROM;
    const inputs = [];
    for (const k of base.inputs) {
        if (k.to <= CUT) inputs.push({ key: k.key, from: k.from, to: k.to });
        else if (k.from < CUT) inputs.push({ key: k.key, from: k.from, to: CUT });
        else if (k.from >= WALK_FROM) {
            inputs.push({ key: k.key, from: k.from + shift, to: Math.min(k.to + shift, TICKS) });
        }
    }
    const lastTo = Math.max(...inputs.map((k) => k.to));
    inputs.push({ key: 'right', from: lastTo, to: TICKS });

    /** Drive the model under a declaration; the observations, the run, and the last removal. */
    function drive(at) {
        const persistence = base.persistence.map((c) => (c.at !== undefined ? { ...c, at } : c));
        let run = null;
        const obs = [];
        const st = createTapeStepper({ ...base, name: NAME, persistence, tick_count: TICKS, inputs }, {
            levelSource: atlasLevelSource(),
            onTick: (t, s, h, rn) => { run = rn; },
        });
        let r = st.next();
        while (!r.done) { obs.push(r.value.observation); r = st.next(); }
        return { obs, run };
    }

    const probe = drive(base.persistence.find((c) => c.at !== undefined).at);
    const ledger = probe.run.ledger('spinnerKillLockOpens').filter((o) => !o.nil && o.level === LEVEL);
    const removal = ledger.length ? ledger[ledger.length - 1].t : null;
    const V9 = removal + V9_FADE;
    const ARM = removal + V9_FADE + 1;
    const DECLARED = GAME_AT;
    const crossOf = (d) => d.obs.find((o) => o.level !== LEVEL)?.t ?? null;
    const game = drive(GAME_AT);
    const v9 = drive(V9);
    const arm = drive(ARM);
    const lockFace = 144 - 2.2;
    const pressedAt = game.obs.find((o) => o.t > START && o.level === LEVEL && o.x >= lockFace)?.t ?? null;

    check('⛓ the walk takes ZERO hits under every reading',
        [game, v9, arm].every((d) => d.run.playerHits.length === 0));
    check('⛓ the kill-lock ledger reads ONE removal in L18, and it is the last body\'s',
        ledger.length === 1 && removal !== null && removal < CUT, JSON.stringify(ledger.map((o) => ({ t: o.t, id: o.id }))));
    check('⛓⛓ the walk DISCRIMINATES: the player is against the lock before every reading',
        pressedAt !== null && pressedAt < GAME_AT, `against the lock at t${pressedAt}; game ${GAME_AT}, v9 ${V9}, arm ${ARM}`);
    check('⛓⛓ under the GAME-SOURCED declaration the model crosses when the game did',
        crossOf(game) === GAME_CROSS, `@${GAME_AT} crosses t${crossOf(game)}; the game t${GAME_CROSS}`);
    check('⛓⛓ the model\'s own two readings are REFUTED: one and two ticks late',
        crossOf(v9) === GAME_CROSS + 1 && crossOf(arm) === GAME_CROSS + 2,
        `v9 @${V9} crosses t${crossOf(v9)}; arm @${ARM} crosses t${crossOf(arm)}`);
    check('⛓⛓ the game\'s tick is the CHASER convention\'s removal (the alpha-zero step, one before the '
        + 'spinner ledger\'s stamp) + the v9 fade', GAME_AT === (removal - 1) + V9_FADE,
        `(${removal} − 1) + ${V9_FADE} = ${(removal - 1) + V9_FADE}`);

    const description = '⛓⛓⛓ SEEDLING FIDELITY F1c D2 — L18\'s SPINNER KILL LOCK, ASKED OF THE GAME. '
        + `\`r9-solve-18\`'s staging and keys through t${CUT} (the last body, \`spinner@112,48\`, is `
        + `stamped removed by the model's ledger on t${removal}), then the segment's own walk to the `
        + `teleporter (its keys from t${WALK_FROM}) started at t${START}, then \`right\`. The player is `
        + `against \`lock@144,112\`'s west face from t${pressedAt}, before every reading. The game crosses `
        + `to L19 on t${GAME_CROSS}: {18,0}@${GAME_AT} is GAME-SOURCED, and the model crosses with it. `
        + `The model's own readings, the v9 spelling ${removal} + ${V9_FADE} = ${V9} and the spinner `
        + `arm's ${removal} + ${V9_FADE + 1} = ${ARM}, cross on t${crossOf(v9)} and t${crossOf(arm)}: the `
        + 'spinner ledger stamps the removal one step after the chaser convention does. Authored by '
        + 'scripts/procgen/plan-seedling-f1c-l18-lock.mjs.';

    const persistence = base.persistence.map((c) => (c.at !== undefined ? {
        level: c.level,
        tag: c.tag,
        note: `GAME-sourced: the player crosses lock@144,112 on t${GAME_CROSS} in the game; the model `
            + `crosses with it under @${GAME_AT}, which is (${removal} − 1) + ${V9_FADE} `
            + '(scripts/procgen/plan-seedling-f1c-l18-lock.mjs)',
        at: DECLARED,
    } : c));
    const tape = { ...base, name: NAME, persistence, tick_count: TICKS, inputs, description };
    delete tape.note;
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
    console.log(`## ${NAME}: ${TICKS} ticks, against the lock t${pressedAt}, ledger removal t${removal}, `
        + `game @${GAME_AT} → t${crossOf(game)}, v9 @${V9} → t${crossOf(v9)}, arm @${ARM} → t${crossOf(arm)}`);

    if (failures > 0) {
        console.error(`\n${failures} CHECK(S) FAILED`);
        process.exit(1);
    }
    console.log('\nall checks green');
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
