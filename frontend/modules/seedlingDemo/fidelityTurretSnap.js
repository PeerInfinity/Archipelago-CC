/**
 * ⛓⛓ SEEDLING FIDELITY TURRETSNAP (wave 35) — A LIVE ICE TURRET IS TOUCHED WHERE `input()` SNAPPED IT, NOT AT ITS
 * PLACEMENT (`CONTACT_FIDELITY.turretSnapPricing`, OFF).
 *
 * The game witnesses (`fixtures/turretsnap-witness/`, p4g headless, `probe-seedling-turret-snap.mjs --record`) boot the
 * player beside L40's `iceturret@472,400` (ctor (488,416), the pocket boot `prox-l40-turret-volley`'s header) and
 * stand still:
 *   - `turretsnap-l40-below-strip`: the player's box (y 438..443) meets only the SNAPPED body (y 408..440 /
 *     407.5..439.5), not the ctor box (y 400..432). The game bills the body's contact on t1, the turret's first update.
 *   - `turretsnap-l40-above-strip`: the player's box (y 398..403) meets only the ctor box. The game bills nothing.
 * The model already steps the turret this way (`stepIceTurret`), so both reproduce at 0 px with the key OFF; the key
 * moves only the danger map's reading of the same body, which OFF calls the reverse of both.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { L40_TURRET, l40PocketBoot } from './fidelityTurretCircle.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const TURRETSNAP_WITNESS_DIR = join(HERE, 'fixtures', 'turretsnap-witness');
export { L40_TURRET };

/** D1's switch. */
export const TURRETSNAP_D1_SWITCHES = Object.freeze({ turretSnapPricing: true });

/** The ticks each witness stands (the first volley spawns at t4 and flies east, clear of both strips). */
export const TURRETSNAP_STAND_TICKS = 16;

/** The two boots (the tape's `boot`, entity point minus 8): the player's entity at (488,440) and (488,400). */
export const TURRETSNAP_BOOTS = Object.freeze({
    'turretsnap-l40-below-strip': Object.freeze({ level: 40, x: 480, y: 432 }),
    'turretsnap-l40-above-strip': Object.freeze({ level: 40, x: 480, y: 392 }),
});

/** A witness tape: the pocket boot's header, the player booted at `TURRETSNAP_BOOTS[name]`, standing. */
export async function turretSnapTape(name) {
    const { buildTape } = await import('./botDriverV1.js');
    const boot = TURRETSNAP_BOOTS[name];
    if (!boot) throw new Error(`turretSnapTape: unknown witness ${name}`);
    const base = await l40PocketBoot({}, name);
    const perTick = [];
    for (let i = 0; i < TURRETSNAP_STAND_TICKS; i += 1) perTick.push(new Set());
    const folded = buildTape(perTick, boot, name, { noclip: false, noDamage: false, noHazards: [], grants: [] });
    return { ...base, name, boot, tick_count: perTick.length, inputs: folded.inputs,
        description: `seedling-fidelity-turretsnap D1: L40, the pocket boot's header with the player booted at entity `
            + `(${boot.x + 8},${boot.y + 8}) beside iceturret@472,400 (ctor (488,416)), standing ${TURRETSNAP_STAND_TICKS} `
            + 'ticks — which box of the live turret the game touches (probe-seedling-turret-snap.mjs)' };
}

const hitFrom = (samples) => samples.find((g) => g.hits > 0)?.t ?? null;

export const TURRETSNAP_WITNESSES = Object.freeze({
    'turretsnap-l40-below-strip': Object.freeze({
        tape: () => turretSnapTape('turretsnap-l40-below-strip'),
        checks: (samples) => [
            { name: 'the game\'s turret snaps on t1 (488,416 → 487.5,424)',
                ok: samples[0]?.turret?.y === 416 && samples[1]?.turret?.x === 487.5 && samples[1]?.turret?.y === 424,
                detail: `t0 ${samples[0]?.turret?.x},${samples[0]?.turret?.y} t1 ${samples[1]?.turret?.x},${samples[1]?.turret?.y}` },
            { name: 'the game bills the body\'s contact on t1 (the player meets only the snapped box)',
                ok: hitFrom(samples) === 1, detail: `first hit t${hitFrom(samples)}` },
        ] }),
    'turretsnap-l40-above-strip': Object.freeze({
        tape: () => turretSnapTape('turretsnap-l40-above-strip'),
        checks: (samples) => [
            { name: 'the game\'s turret snaps on t1 (488,416 → 487.5,424)',
                ok: samples[0]?.turret?.y === 416 && samples[1]?.turret?.x === 487.5 && samples[1]?.turret?.y === 424,
                detail: `t0 ${samples[0]?.turret?.x},${samples[0]?.turret?.y} t1 ${samples[1]?.turret?.x},${samples[1]?.turret?.y}` },
            { name: 'the game bills nothing (the player meets only the ctor box)',
                ok: samples.every((g) => g.hits === 0), detail: `hits at the end ${samples.at(-1)?.hits}` },
        ] }),
});
