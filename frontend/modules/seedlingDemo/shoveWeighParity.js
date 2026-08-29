/**
 * shoveWeighParity — THE ONE-STEP RECORD SHAPES, CAPTURED AS A CONTROL.
 *
 * ⛓⛓⛓ R9 SLICE L15 (kickoff §54.4, ⚖ 65 (a)): `resolveShoveStrategy` and
 * `resolveWeighStrategy` resolve through ONE block-route search, and the law
 * that lets that land tape-inert is *"a one-step route returns TODAY'S RECORD
 * SHAPE, field for field"*. A law about bytes is measured, not argued: this
 * module captures the `shove`/`weigh` trace rows and records of every
 * committed one-step room, and `shoveWeighParity.test.js` diffs the LIVE
 * capture against `fixtures/shove-weigh-parity.json`, which was written at the
 * PRE-slice head (`f5d7b43fc`) BEFORE the search existed.
 *
 * ⛔ THE FIXTURE IS A CONTROL, NOT A SNAPSHOT TO REFRESH. It is a claim about
 * two builds ([[feedback_fixture_must_discriminate_two_builds]]): the build it
 * was captured from and the one under test. Re-writing it after a change that
 * moved a record would turn the control into a fixed point
 * ([[feedback_fixed_point_is_not_correctness]]). Regenerate it ONLY when a
 * ruling moves the one-step record shape on purpose, and say so in `note`:
 *
 *   node --input-type=module -e "import('./frontend/modules/seedlingDemo/shoveWeighParity.js').then((m) => m.writeParityFixture(process.argv[1]))" -- <head>
 *
 * ⚠ THE ROOMS ARE THE COMMITTED ONE-STEP CUSTOMERS (§54.6) — L4 step 4, L8's
 * two shoves (the second only on the sink arm), and A16 L4, whose refusal
 * must stay byte-identical (§54.6). L15 is deliberately NOT here: it is the
 * room the search exists to change.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseTape } from './tapeFormat.js';
import { atlasLevelSource } from './levelSource.js';
import { createLevelRun } from './levelRun.js';
import { ROLES } from './levelWorld.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TAPES = join(HERE, 'fixtures', 'tapes');
export const PARITY_FIXTURE = join(HERE, 'fixtures', 'shove-weigh-parity.json');

/** The survey's staged-boot base — `survey-seedling-route.mjs`'s own `STAGED_BASE`. */
const STAGED_BASE = 'r8-solve-11';

const readTape = (name) => parseTape(JSON.parse(readFileSync(join(TAPES, `${name}.json`), 'utf8')));

function committedRun(levelSource, name, over = {}) {
    const t = readTape(name);
    const run = createLevelRun({
        levelSource, boot: t.boot, noclip: false, noHazards: t.noHazards, noDamage: false,
        grants: t.grants, persistence: t.persistence, despawn: [], equips: t.equips,
        pins: t.pins ?? [], save: t.save ?? null, rng: t.rng ?? null, seam: t.seam ?? null,
        roles: ROLES, ...over,
    });
    return { run, boot: t.boot };
}

/**
 * The survey's staged construction (`survey-seedling-route.mjs solveOneStep`):
 * `STAGED_BASE`'s block re-pointed at the arrival, timed clears STRIPPED.
 */
export function stagedRun(levelSource, level, x, y) {
    const staging = solveStaging(stagingFromTape(readTape(STAGED_BASE)));
    staging.boot = { level, x, y };
    staging.persistence = (staging.persistence ?? []).filter((r) => r.at === undefined);
    return { run: createRunForStaging(staging, levelSource), boot: staging.boot };
}

/** The rooms, each with how it boots and what it is asked. */
export const PARITY_ROOMS = Object.freeze([
    { key: 'L4 step 4 (r8-solve-4)', boot: { committed: 'r8-solve-4' },
        goals: [{ kind: 'reach-exit', exit: { x: 64, y: 16 } }] },
    { key: 'L8 (r8-solve-8)', boot: { committed: 'r8-solve-8' },
        goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }] },
    { key: 'L8 sink (r8-solve-8 + {5,0})',
        boot: { committed: 'r8-solve-8', over: { persistence: [{ level: 5, tag: 0 }] } },
        goals: [{ kind: 'reach-exit', exit: { x: 96, y: 192 } }] },
    { key: 'A16 L4 staged (64,32)', boot: { staged: { level: 4, x: 64, y: 32 } },
        goals: [{ kind: 'reach-exit', exit: { x: 0, y: 16 } }] },
]);

const VERBS = new Set(['shove', 'weigh']);
const pickRows = (rows) => rows.filter((r) => VERBS.has(r.strategy?.verb))
    .map((r) => ({ tick: r.tick, obstacle: r.obstacle, strategy: r.strategy, rejected: r.rejected }));

/** Capture one room: the verdict, its shove/weigh rows and records. */
export function captureRoom(levelSource, room) {
    const { run, boot } = room.boot.committed
        ? committedRun(levelSource, room.boot.committed, room.boot.over)
        : stagedRun(levelSource, room.boot.staged.level, room.boot.staged.x, room.boot.staged.y);
    try {
        const out = solveSegment({ run, goals: room.goals, name: room.key, boot });
        return {
            verdict: 'SOLVED', ticks: out.perTick.length, rows: pickRows(out.trace.rows),
            records: out.records.filter((r) => VERBS.has(r.strategy)),
        };
    } catch (e) {
        return { verdict: 'REFUSED', message: e.message, rows: pickRows(e.rows ?? []) };
    }
}

export function captureShoveWeighRecords() {
    const levelSource = atlasLevelSource();
    const rooms = {};
    for (const room of PARITY_ROOMS) rooms[room.key] = captureRoom(levelSource, room);
    return rooms;
}

export const readParityFixture = () => JSON.parse(readFileSync(PARITY_FIXTURE, 'utf8'));

export function writeParityFixture(head, note = 'the pre-slice control (R9 slice L15 W0)') {
    if (!head) throw new Error('writeParityFixture: name the HEAD the control is captured at');
    const out = { head, capturedAt: new Date().toISOString(), note, rooms: captureShoveWeighRecords() };
    writeFileSync(PARITY_FIXTURE, `${JSON.stringify(out, null, 1)}\n`);
    return out;
}
