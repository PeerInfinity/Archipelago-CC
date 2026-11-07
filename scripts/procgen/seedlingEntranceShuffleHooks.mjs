/**
 * seedlingEntranceShuffleHooks — **SEEDLING'S HOOKS FOR THE ENTRANCE-SHUFFLE MODE** (ENTRANCE RANDOMIZATION E4b), the
 * object `procgenPipeline/entranceShuffleSteps.js` drives. Node-side: the producer reads the map from disk. The registry
 * entry (`flashPanel/flashSeedlingLibrary.js` `entranceShuffle`) declares the atlas and loads this module.
 *
 *   pool({atlasId})        the playthrough atlas, BUILT by the producer in this process (`buildPlaythroughAtlas`): the
 *                          compile reads the analysis pass's per-region state, so the atlas must be this process's own.
 *                          Its id must equal the committed atlas's (the producer's `--check` holds that).
 *   classify(atlas)        `flashPanel/seedlingEntranceClassifier.classifySeedlingEntrances` over E1's census of this
 *                          atlas (`census-seedling-er-doorways.loadCensusInputs` + `seedlingErDoorCensus.censusErDoorways`).
 *   compile(atlas, {moved}) the producer's own compile (`compilePlaythroughRules`); with a non-empty `moved`, the derived-
 *                          rule table is applied by ATLAS ENDPOINT and the moved exits are skipped by name (R-A3). Every
 *                          producer guard `main` holds at exit is a THROW here (composed ≠ table, an uncharged floored
 *                          way in, a stray rope event): on a shuffled doc they are defects, not rejected draws.
 *   checks(rules, ctx)     Seedling's own refusals of a compiled layout (a reason per refusal; the mode takes the next draw):
 *     EARLY-SPHERE         the shuffled sphere walk collects at least one advancement location in sphere 0 or 1 AND
 *                          sphere 0 is not smaller than vanilla's. Why this bound: the start sub-region (L0 r7c6) is where
 *                          both L0 stairs leave and both reverses land (E1 (E)); a shuffle that hands the start a dead-end
 *                          stair can leave a beatable world whose opening is empty — that is what this refuses, and it
 *                          refuses nothing vanilla allows (vanilla's own sphere 0 is the floor).
 *     PERMISSIVE           no MOVED stair lands in the sub-region of a permissive binding E1 (D) marks AT RISK (the
 *                          classifier pins them, PIN-PERMISSIVE; this re-reads the census so a pin dropped is caught).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { argvHelp } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const imp = (p) => import(pathToFileURL(join(REPO, p)));

const sphereNo = (e) => Number(String(e.sphere_index).split('.')[0]);

/** Locations collected per whole sphere: `Map<sphere, string[]>`. */
export function locationsBySphere(log, playerId = '1') {
    const out = new Map();
    for (const e of log.filter((x) => x.type === 'state_update')) {
        const n = sphereNo(e);
        const locs = e.player_data?.[playerId]?.sphere_locations ?? [];
        out.set(n, [...(out.get(n) ?? []), ...locs]);
    }
    return out;
}

/** Sphere 0's ACCESSIBLE locations (the walk's first state: what the start reaches with the starting items). */
export const sphereZeroAccessible = (log, playerId = '1') => log.find((e) => e.type === 'state_update' && e.sphere_index === '0')
    ?.player_data?.[playerId]?.new_accessible_locations ?? [];

export async function seedlingEntranceShuffleHooks() {
    const P = await import('./make-seedling-playthrough-rules.mjs');
    const C = await import('./census-seedling-er-doorways.mjs');
    const K = await import('./seedlingErDoorCensus.js');
    const { classifySeedlingEntrances } = await imp('frontend/modules/flashPanel/seedlingEntranceClassifier.js');
    const { generateSphereLog } = await imp('frontend/modules/shared/procgen/forwardSimulator.js');
    const { readFileSync } = await import('node:fs');
    const committedAtlasId = JSON.parse(readFileSync(P.PLAYTHROUGH_ATLAS_PATH, 'utf8')).atlas_id;
    let census = null;
    let built = null;
    let vanillaSphereZero = null;

    const hooks = {
        pool: async ({ atlasId }) => {
            if (atlasId !== committedAtlasId) {
                throw new Error(`seedling entranceShuffle: atlas ${atlasId} is not the committed playthrough atlas ${committedAtlasId}`);
            }
            built = P.buildPlaythroughAtlas();
            if (built.atlas_id !== committedAtlasId) {
                throw new Error(`seedling entranceShuffle: the producer built ${built.atlas_id}, the committed atlas is ${committedAtlasId} — run the producer's --check`);
            }
            return { atlas: structuredClone(built) };
        },
        classify: async (atlas) => {
            const inputs = await C.loadCensusInputs();
            // loadCensusInputs rebuilt the atlas in this process; the compile's per-region state is that build's (equal content).
            census = K.censusErDoorways({ ...inputs, atlas });
            return classifySeedlingEntrances(atlas, { census, inScopeClasses: K.IN_SCOPE_CLASSES, opposite: K.OPPOSITE });
        },
        compile: async (atlas, { moved = new Set() } = {}) => {
            const out = P.compilePlaythroughRules(structuredClone(atlas), moved.size ? { rekey: { moved } } : {});
            const defects = [
                ...out.disagrees.map((d) => `COMPOSED ≠ TABLE at ${d.key} (${d.compare})`),
                ...out.uncharged.map((u) => `a way into a floored level is not charged its entry gate: ${u.exit}`),
                ...out.stray.map((n) => `the rules name a rope event never minted: ${n}`),
            ];
            if (defects.length) throw new Error(`seedling entranceShuffle: the producer's guards refuse the compile: ${defects.join('; ')}`);
            const notes = (out.override.skipped ?? []).map((s) => `derived-rule table: ${s.key} skipped (${s.at}: ${s.why})`);
            if (!moved.size) vanillaSphereZero = sphereZeroAccessible(generateSphereLog(out.rules, { playerId: 1 })).length;
            return { rules: out.rules, notes, override: out.override };
        },
        checks: async (rules, { log, atlas, classification, placements = [] }) => {
            const out = [];
            const by = locationsBySphere(log);
            const early = [...(by.get(0) ?? []), ...(by.get(1) ?? [])];
            const s0 = sphereZeroAccessible(log).length;
            if (early.length === 0) out.push('EARLY-SPHERE: spheres 0 and 1 collect no advancement location');
            if (vanillaSphereZero !== null && s0 < vanillaSphereZero) out.push(`EARLY-SPHERE: sphere 0 reaches ${s0} location(s), vanilla ${vanillaSphereZero}`);
            // A door placed AT E lands beside E (C-BESIDE: in E's own sub-region).
            const byId = new Map(classification.doorways.map((d) => [d.id, d]));
            const subOf = (end) => atlas.regions.find((r) => r.region_id === end[0])?.exits.find((e) => e.exit_id === end[1])?.sub_region ?? null;
            for (const p of census?.permissive ?? []) {
                if (!p.atRisk) continue;
                const hit = placements.filter((pl) => pl.target !== byId.get(pl.exit).reverse)
                    .filter((pl) => { const E = byId.get(pl.target); return E.arrival[0] === `level_${p.level}` && subOf(E.arrival) === p.subRegion; })
                    .map((pl) => pl.exit);
                if (hit.length) out.push(`PERMISSIVE: ${p.binding} [${p.subRegion}] — moved stair(s) ${hit.join(', ')} land in it`);
            }
            return out;
        },
        /** The census the last classify took (for the report and the tests). */
        get census() { return census; },
        get vanillaSphereZero() { return vanillaSphereZero; },
    };
    return hooks;
}
