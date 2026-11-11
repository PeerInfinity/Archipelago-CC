/**
 * surveyPreset — WHICH WORLD THE ROUTE SURVEY WALKS (ER E6).
 *
 * `survey-seedling-route.mjs` read three things about ONE world, each by a typed path: the playthrough's rules,
 * the committed sphere order made from the playthrough's own sphere log, and the vanilla rooms. `--preset=<id>`
 * makes the world a parameter, and each of the three is then read off THAT preset's rules export:
 *
 *   rules          `frontend/presets/<id>/AP_<seed>/AP_<seed>_rules.json` (found, as before);
 *   sphere order   the committed artifact for the default preset (its bytes do not move); for any other preset
 *                  the SAME rows, derived: the shared sphere walk (`generateSphereLog`, the walk every preset's
 *                  log is) over the rules, read by the artifact's own reader (`orderRows`). ⛓ Pinned: over the
 *                  default preset's rules that derivation IS the committed artifact, row for row
 *                  (`surveyPreset.test.js`), so a derived order is the artifact a log would have produced.
 *   rooms          the DELIVERED rooms. A world whose rules place entrances (`entrance_randomization`) is played
 *                  on rooms whose moved stairs are rewritten (`seedlingDemo/entranceRetarget.js`, applied by the
 *                  randomized load), so the survey's atlas edges, arrivals and model worlds are those rooms: the
 *                  same plan, applied to the same records. A world that places none gets the document it handed
 *                  in, the same object.
 *
 * Nothing here knows a preset by name beyond the default's id: a world is described by its rules.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { generateSphereLog } from '../../frontend/modules/shared/procgen/forwardSimulator.js';
import { planEntranceRetarget } from '../../frontend/modules/seedlingDemo/entranceRetarget.js';
import { retargetRoomRecord } from '../../frontend/modules/seedlingDemo/levelSetExits.js';
import { orderRows } from './make-seedling-sphere-order.mjs';

/** The preset the survey walks when none is named: the honest playthrough. */
export const DEFAULT_SURVEY_PRESET = 'seedling_playthrough';

/** The committed sphere order: the DEFAULT preset's, made from its own sphere log. */
export const COMMITTED_SPHERE_ORDER = 'frontend/modules/flashPanel/atlases/seedling-sphere-order.json';

/** A preset id is a directory name under `frontend/presets/`, never a path. */
export function assertPresetId(preset) {
    if (typeof preset !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(preset)) {
        throw new Error(`--preset=${preset} — a preset is a directory name under frontend/presets/ `
            + '(lowercase letters, digits, `_`, `-`)');
    }
    return preset;
}

/** The preset's rules export — found, never hardcoded. */
export function presetRulesPath(repo, preset) {
    const base = join(repo, 'frontend', 'presets', assertPresetId(preset));
    let seeds;
    try { seeds = readdirSync(base).filter((d) => d.startsWith('AP_')).sort(); } catch {
        throw new Error(`--preset=${preset}: no directory ${base}`);
    }
    if (seeds.length === 0) {
        throw new Error(`no AP_* export under ${base} — the region graph is the route derivation's `
            + 'authority on gating and this survey cannot proceed without it');
    }
    return join(base, seeds[0], `${seeds[0]}_rules.json`);
}

/**
 * The sphere order of a rules export, derived: `{rows, seed, seedName}` in the committed artifact's row shape
 * (`{sphere, location, item, level}`). The events (`event_kind`) never number a label, as in the artifact.
 */
export function sphereOrderOfRules(rules, slot = '1') {
    const locations = Object.values(rules?.regions?.[slot] ?? {}).flatMap((r) => r.locations ?? []);
    const events = locations.filter((l) => l.event_kind !== undefined || l.event === true);
    const log = generateSphereLog(rules, {
        playerId: slot,
        metadata: {
            event_locations: { [slot]: events.map((l) => l.name) },
            event_items: { [slot]: events.map((l) => l.item?.name).filter(Boolean) },
        },
    });
    return orderRows(log);
}

/**
 * The sphere order the survey reads for `preset`: `{order, source}`. The default preset's is the committed
 * artifact (byte for byte what the survey always read); any other preset's is derived from its rules.
 */
export function sphereOrderFor({ repo, preset, rules, slot = '1' }) {
    if (preset === DEFAULT_SURVEY_PRESET) {
        return { order: JSON.parse(readFileSync(join(repo, COMMITTED_SPHERE_ORDER), 'utf8')).order,
            source: COMMITTED_SPHERE_ORDER };
    }
    return { order: sphereOrderOfRules(rules, slot).rows,
        source: 'derived: generateSphereLog over the preset\'s rules, read by make-seedling-sphere-order.orderRows' };
}

/**
 * The map document a world is PLAYED on: `{doc, plan}`. `plan` is `planEntranceRetarget`'s (null when the rules
 * place no entrance); with nothing moved `doc` IS `mapDoc` (same object). Otherwise each planned exit of each
 * level record is rewritten by the delivery's own writer (`retargetRoomRecord`), every other field kept.
 */
export function deliveredMapDocument(mapDoc, rules, slot = '1') {
    const levels = mapDoc?.levels;
    if (!Array.isArray(levels)) throw new Error('deliveredMapDocument: the map document has no `levels`');
    const plan = planEntranceRetarget({ rules, slot,
        set: { rooms: levels.map((l) => ({ id: l.level, source: { record: l } })) } });
    if (!plan || plan.byLevel.size === 0) return { doc: mapDoc, plan };
    const out = levels.map((l) => {
        const edits = plan.byLevel.get(l.level);
        if (!edits) return l;
        const { record, applied } = retargetRoomRecord(l, { exits: edits });
        if (applied !== edits.length) {
            throw new Error(`deliveredMapDocument: level ${l.level} took ${applied} of ${edits.length} exit edits`);
        }
        return record;
    });
    return { doc: { ...mapDoc, levels: out }, plan };
}
