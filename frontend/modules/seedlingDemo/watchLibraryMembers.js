/**
 * watchLibraryMembers — WHAT ONE LIBRARY SAVE OF THE SEEDLING LAB HOLDS (document library B3).
 *
 * ⛓ A numbered version is the BUNDLE's members at that moment: the set and the overlay from
 * `downloadSet(session)` (validated, stamped once — the `adapterFns.download` every door calls), and
 * the rules and the atlas from `reportOf` + `atlasAtDoor` (the `currentReport() ?? runReport()` and
 * `atlasAtDoor(rep.atlas, rep.rules)` the bundle and door A read). It calls the SAME functions over
 * the SAME record, so the saved set's fingerprint is the bundle's `level-set` member's and the one the
 * handed rules name (`region_atlas[p].level_set.content_hash`) — pinned by a vitest row and by the
 * `seedling-lab-library` browser check.
 *
 * ⛔ It never reads the mount's `lastReport`: a report run before the last edit would be a STALE
 * version (the B3 mutant "the version's set taken from a stale report" reds on it). It recomputes
 * over the record it is handed, which is the record at the save point.
 *
 * ⚖ Q2 (Robert, 2026-11-22: "Draft, marked won't play"): a save point that finds the set invalid
 * (the download's validation refuses it) or that cannot compile rules saves a DRAFT with
 * `wontPlay: '<why>'`, never a version.
 *
 * ⛓ A DRAFT (an edit, `op`) holds the set and the overlay stamped WITHOUT validation
 * (`downloadSet(session, {validate: false})`), so it carries its own fingerprint and the LOAD door's
 * `validateLevelSet` stamp check accepts it when it is opened from "Recent sets".
 *
 * Pure: no DOM, no storage. It runs in the library worker (`watchLibraryWorker.js`) and in vitest.
 */
import { compileRegionAtlas } from '../procgenPipeline/regionAtlasCompiler.js';
import { stampAtlasIdentity, validateRegionAtlas } from '../procgenPipeline/regionAtlasValidator.js';
import { tileTypeForPlacement } from '../flashPanel/seedlingSemantics.js';
import { TILE_SIZE } from './levelWorld.js';
import { parseOelLevel } from './procgenLevelOel.js';
import {
    createSeedlingSetAdapter, createSetSession, downloadSet, setRecord, validateForDownload,
} from './seedlingSetAdapter.js';
import { reportOf } from './watchSetEditor.js';
import { WATCH_SET_ATLAS, labSetIdentity } from './watchSetIdentity.js';

/** The member roles a version carries (study §1: set / overlay / atlas / rules, as the bundle's members). */
export const MEMBER_ROLES = Object.freeze({ set: 'set', overlay: 'overlay', rules: 'rules', atlas: 'atlas' });

/**
 * The set editor's derivation deps, built exactly as `watchViewer.js` builds `setDeps` (the page passes
 * the same three optional schemas it fetched; each may be null).
 */
export function setDepsOf({ rulesSchema = null, levelSetSchema = null } = {}) {
    return {
        parseOel: parseOelLevel,
        tileSize: TILE_SIZE,
        tileTypeForPlacement,
        rulesSchema,
        levelSetSchema,
        atlas: WATCH_SET_ATLAS,
    };
}

/**
 * Everything a save needs that does not change per save: the deps, an adapter, the lab's own stamping
 * compile (its OWN `labSetIdentity`, so the page's door memory is never touched) and the atlas schema.
 */
export function membersContextOf({ rulesSchema = null, levelSetSchema = null, atlasSchema = null } = {}) {
    const deps = setDepsOf({ rulesSchema, levelSetSchema });
    return {
        deps,
        adapter: createSeedlingSetAdapter(deps),
        identity: labSetIdentity({ compileRegionAtlas, stampAtlasIdentity }),
        atlasSchema,
    };
}

const sessionOver = (ctx, record) => {
    const rec = setRecord(record.set, record.overlay);
    return createSetSession(ctx.adapter, rec, { base: { kind: 'set', set_id: rec.set.set_id } });
};

const setMembers = (out) => [
    { role: MEMBER_ROLES.set, idKey: 'set_id', doc: out.set },
    { role: MEMBER_ROLES.overlay, idKey: 'overlay_id', doc: out.overlay },
];

/**
 * What a save of `record` writes.
 * @param {{set: object, overlay: object}} record  the set session's record at the save point
 * @param {'version'|'draft'} kind
 * @returns {{draft: boolean, wontPlay: string|null, members: Array<{role, idKey, doc}>, label: string|null}}
 */
export function librarySaveOf(record, kind, ctx) {
    const session = sessionOver(ctx, record);
    const label = typeof record.set?.name === 'string' && record.set.name ? record.set.name : (record.set?.set_id ?? null);
    if (kind === 'draft') {
        return { draft: true, wontPlay: null, members: setMembers(downloadSet(session, { validate: false })), label };
    }
    const check = validateForDownload(session);
    if (!check.ok) {
        return {
            draft: true,
            wontPlay: `the set does not validate (${check.errors.length} error(s)): ${check.errors.join(' · ')}`,
            members: setMembers(downloadSet(session, { validate: false })),
            label,
        };
    }
    const out = downloadSet(session);
    const rep = reportOf(session, ctx.deps, {
        compileRegionAtlas: ctx.identity.compileRegionAtlas,
        validateRegionAtlas,
        atlasSchema: ctx.atlasSchema ?? undefined,
    });
    if (!rep.download.rules.allowed || !rep.rules) {
        return {
            draft: true,
            wontPlay: `no rules.json compiles: ${rep.download.rules.why ?? 'the report refused the export'}`,
            members: setMembers(out),
            label,
        };
    }
    const members = [...setMembers(out), { role: MEMBER_ROLES.rules, idKey: null, doc: rep.rules }];
    if (rep.atlas) {
        members.push({ role: MEMBER_ROLES.atlas, idKey: 'atlas_id', doc: ctx.identity.atlasAtDoor(rep.atlas, rep.rules) });
    }
    return { draft: false, wontPlay: null, members, label };
}
