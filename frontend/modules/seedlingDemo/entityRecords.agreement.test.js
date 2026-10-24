/**
 * THE TWO SPELLINGS, MEASURED (behaviour-parameters P1, D3).
 *
 * A stepped class is spelled twice, by ROLE: `ENEMY_CLASSES.<tag>` /
 * `PUZZLEMENT_HAZARDS.<tag>` is the census and pricing record, and the
 * stepping module's own table (`CHASERS`, `SPINNER`, `CRUSHER`, `PULSER`,
 * `ARROW_TRAP`, `ICE_TURRET`) is what the tick loop reads. Where the two
 * spell the same AS3 field this file holds them together, one explicit
 * `[recordA.path, recordB.path]` row per field — no fuzzy matching.
 *
 * ⛔ A row that DISAGREES is pinned with `it.fails` and both values, NOT
 * fixed: which spelling is right is a question for the slice that owns the
 * pricing, and moving either value would move a solve or a tape.
 */
import { describe, expect, it } from 'vitest';

import { CHASERS } from './chasers.js';
import { ENEMY_CLASSES, PUZZLEMENT_HAZARDS } from './combat.js';
import { CRUSHER } from './crusher.js';
import { ARROW_TRAP } from './arrowTrap.js';
import { ICE_TURRET } from './iceTurret.js';
import { PULSER } from './pulser.js';
import { SPINNER } from './spinner.js';

const ROOTS = { CHASERS, ENEMY_CLASSES, PUZZLEMENT_HAZARDS, CRUSHER, ARROW_TRAP, ICE_TURRET, PULSER, SPINNER };
/** The value at a dotted path from one of ROOTS; throws on a missing step so a typo cannot pass as `undefined === undefined`. */
const at = (path) => path.split('.').reduce((o, k, i, all) => {
    if (o === null || typeof o !== 'object' || !(k in o)) throw new Error(`${all.slice(0, i + 1).join('.')} does not exist`);
    return o[k];
}, ROOTS);

/** Every stepped tag exists in its census table. */
const EXISTS = [
    ...Object.keys(CHASERS).map((tag) => `ENEMY_CLASSES.${tag}`),
    'ENEMY_CLASSES.spinner',
    'ENEMY_CLASSES.iceturret',
    'PUZZLEMENT_HAZARDS.crusher',
    'PUZZLEMENT_HAZARDS.pulser',
    `PUZZLEMENT_HAZARDS.${ARROW_TRAP.tag}`,
];

/** [stepping record path, census record path] — the fields the two spell in common. */
const AGREE = [
    ['CHASERS.bob.as3', 'ENEMY_CLASSES.bob.as3'],
    ['CHASERS.jellyfish.as3', 'ENEMY_CLASSES.jellyfish.as3'],
    ['SPINNER.dx', 'ENEMY_CLASSES.spinner.ctor.dx'],
    ['SPINNER.dy', 'ENEMY_CLASSES.spinner.ctor.dy'],
    ['SPINNER.w', 'ENEMY_CLASSES.spinner.hitbox.w'],
    ['SPINNER.h', 'ENEMY_CLASSES.spinner.hitbox.h'],
    ['SPINNER.originX', 'ENEMY_CLASSES.spinner.hitbox.ox'],
    ['SPINNER.originY', 'ENEMY_CLASSES.spinner.hitbox.oy'],
    ['SPINNER.moveSpeed', 'ENEMY_CLASSES.spinner.speed'],
    ['SPINNER.runRange', 'ENEMY_CLASSES.spinner.aggro.range'],
    ['SPINNER.activeOffScreen', 'ENEMY_CLASSES.spinner.offScreen'],
    ['SPINNER.damage', 'ENEMY_CLASSES.spinner.damage'],
    ['SPINNER.hitsMax', 'ENEMY_CLASSES.spinner.kill.hits'],
    ['SPINNER.hammerLength', 'ENEMY_CLASSES.spinner.threatPad'],
    ['CRUSHER.dx', 'PUZZLEMENT_HAZARDS.crusher.ctor.dx'],
    ['CRUSHER.dy', 'PUZZLEMENT_HAZARDS.crusher.ctor.dy'],
    ['CRUSHER.damage', 'PUZZLEMENT_HAZARDS.crusher.damage'],
    ['PULSER.box.dx', 'PUZZLEMENT_HAZARDS.pulser.ctor.dx'],
    ['PULSER.box.dy', 'PUZZLEMENT_HAZARDS.pulser.ctor.dy'],
    ['PULSER.damage', 'PUZZLEMENT_HAZARDS.pulser.damage'],
    ['ARROW_TRAP.as3', 'PUZZLEMENT_HAZARDS.arrowtrap.as3'],
    ['ARROW_TRAP.ctor.dx', 'PUZZLEMENT_HAZARDS.arrowtrap.ctor.dx'],
    ['ARROW_TRAP.ctor.dy', 'PUZZLEMENT_HAZARDS.arrowtrap.ctor.dy'],
    ['ICE_TURRET.ctor.dx', 'ENEMY_CLASSES.iceturret.ctor.dx'],
    ['ICE_TURRET.ctor.dy', 'ENEMY_CLASSES.iceturret.ctor.dy'],
    ['ICE_TURRET.alive.w', 'ENEMY_CLASSES.iceturret.hitbox.w'],
    ['ICE_TURRET.alive.h', 'ENEMY_CLASSES.iceturret.hitbox.h'],
    ['ICE_TURRET.alive.originX', 'ENEMY_CLASSES.iceturret.hitbox.ox'],
    ['ICE_TURRET.alive.originY', 'ENEMY_CLASSES.iceturret.hitbox.oy'],
    ['ICE_TURRET.attackRange', 'ENEMY_CLASSES.iceturret.aggro.range'],
    ['ICE_TURRET.hitsMax', 'ENEMY_CLASSES.iceturret.kill.hits'],
    ['ICE_TURRET.activeOffScreen', 'ENEMY_CLASSES.iceturret.offScreen'],
    ['ICE_TURRET.moveSpeed', 'ENEMY_CLASSES.iceturret.corpse.glideSpeed'],
    ['ICE_TURRET.pushedBy', 'ENEMY_CLASSES.iceturret.corpse.pushedBy'],
];

/**
 * The rows that DISAGREE today, each with both values and why it is left.
 * `it.fails` keeps them honest both ways: the file goes red the day a row
 * starts agreeing (then it moves to AGREE) and the day a value moves.
 */
const DISAGREE = [
    {
        pair: ['ICE_TURRET.moveSpeed', 'ENEMY_CLASSES.iceturret.speed'],
        values: [0.5, 0],
        // `IceTurret.as` `moveSpeed = 0.5` is the CORPSE's glide
        // (`iceTurret.js` steps it; `ENEMY_CLASSES.iceturret.corpse.glideSpeed`
        // spells the same 0.5 and agrees above). `ENEMY_CLASSES.iceturret.speed`
        // is the census's chase-envelope bound for the LIVE turret, which never
        // moves — so 0 there is a role, not a transcription error. Same AS3
        // field, two meanings; recorded, not reconciled.
        why: 'the census speed is the live turret\'s envelope bound (0, static); the stepping moveSpeed is the corpse glide (0.5)',
    },
];

describe('entity records — the two spellings exist', () => {
    it.each(EXISTS)('%s exists', (path) => {
        expect(() => at(path)).not.toThrow();
    });

    it('ARROW_TRAP.tag names its PUZZLEMENT_HAZARDS row', () => {
        expect(ARROW_TRAP.tag).toBe('arrowtrap');
    });
});

describe('entity records — the two spellings agree', () => {
    it.each(AGREE)('%s === %s', (a, b) => {
        expect(at(a)).toEqual(at(b));
    });
});

describe('entity records — the two spellings DISAGREE (pinned, not fixed)', () => {
    for (const { pair: [a, b], values, why } of DISAGREE) {
        it(`${a} = ${JSON.stringify(values[0])} and ${b} = ${JSON.stringify(values[1])} — ${why}`, () => {
            expect([at(a), at(b)]).toEqual(values);
        });
        it.fails(`${a} === ${b} (fails today: ${why})`, () => {
            expect(at(a)).toEqual(at(b));
        });
    }
});
