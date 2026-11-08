/**
 * Cloudberry's part of the substrate status strip (`flashSubstrate/statusStrip.js`): which items a
 * level uses, read from its region payload. Pure.
 *
 * The facts a level's rules came from are `pieceItems` (piece k's platform items, cumulative) and the
 * hero (`jetpack`, `doubleJump`) — see cloudberryRules.js `documentFacts`. A region payload does not
 * store them; it stores the resolved generator REQUEST, and the generated document realises exactly
 * the request's piece upgrades (`readCloudberryDocument` refuses a document that does not), so the
 * request's platform upgrades are the level's platform items. A payload that does carry `facts`
 * (a library entry's payload) is read first. The hero is the request's `heroCustom.move`.
 */

import { CLOUDBERRY_ITEM_NAMES, CLOUDBERRY_ABILITY_ITEMS, CLOUDBERRY_LIBRARY_ITEMS } from './cloudberryRules.js';
import { CLOUDBERRY_HERO_PHYSICS } from './cloudberryProcgenParams.js';
import { checkpointName } from '../flashSubstrate/statusStripModel.js';

const PLATFORM_ITEMS = Object.keys(CLOUDBERRY_ITEM_NAMES).filter((g) => !CLOUDBERRY_ABILITY_ITEMS.includes(g));

/** The level's facts from its payload params: { pieceItems: [[game items]], jetpack, doubleJump } or null. */
export function cloudberryLevelFacts(params) {
    if (!params || typeof params !== 'object') return null;
    const f = params.facts;
    if (f && Array.isArray(f.pieceItems)) {
        return { pieceItems: f.pieceItems.map((p) => [...p]), jetpack: f.jetpack === true, doubleJump: f.doubleJump === true };
    }
    const pieces = params.generate?.pieces;
    if (!Array.isArray(pieces)) return null;
    const move = params.generate?.heroCustom?.move ?? null;
    return {
        pieceItems: pieces.map((p) => PLATFORM_ITEMS.filter((g) => Object.hasOwn(p?.upgrades ?? {}, g))),
        jetpack: move === 'Jetpack',
        doubleJump: move === 'Double',
    };
}

/**
 * The hero's physics where they differ from the game's own hero (P5b), as short text, or null.
 * Only the sliders that act on this level's kind are named.
 */
export function cloudberryHeroNote(params) {
    const phsx = params?.generate?.heroCustom?.phsx;
    if (!phsx || typeof phsx !== 'object') return null;
    const move = params.generate.heroCustom.move ?? null;
    const kind = move === 'Jetpack' ? 'jetpack' : (move === 'Double' ? 'double' : 'plain');
    const parts = [];
    for (const h of CLOUDBERRY_HERO_PHYSICS) {
        if (h.levels !== 'all' && h.levels !== kind) continue;
        const v = phsx[h.phsx];
        if (typeof v !== 'number' || v === h.def) continue;
        parts.push(`${h.label.replace(/ \(.*\)$/, '').toLowerCase()} ${Number(v.toFixed(2))}`);
    }
    return parts.length ? `hero: ${parts.join(', ')}` : null;
}

/**
 * The strip's `describeLevel(world)` for Cloudberry: the level's items in the order the level brings
 * them in (the ability hero first: it is needed everywhere), with where each starts.
 * → { items: [{ name: AP name, kind: 'ability'|'platform', note, color }], notes: [text] } or null.
 */
export function describeCloudberryLevel(world) {
    const params = world?.params;
    const facts = cloudberryLevelFacts(params);
    if (!facts) return null;
    const items = [];
    if (facts.jetpack) items.push({ name: CLOUDBERRY_ITEM_NAMES.Jetpack, kind: 'ability', note: 'whole level', color: CLOUDBERRY_LIBRARY_ITEMS.Jetpack.color });
    if (facts.doubleJump) items.push({ name: CLOUDBERRY_ITEM_NAMES.DoubleJump, kind: 'ability', note: 'whole level', color: CLOUDBERRY_LIBRARY_ITEMS['Double Jump'].color });
    const seen = new Set();
    const add = (game, kind, note) => {
        const name = CLOUDBERRY_ITEM_NAMES[game];
        items.push({ name, kind, note, color: CLOUDBERRY_LIBRARY_ITEMS[name]?.color ?? null });
    };
    facts.pieceItems.forEach((list, k) => {
        for (const g of list) {
            if (seen.has(g) || !CLOUDBERRY_ITEM_NAMES[g]) continue;
            seen.add(g);
            add(g, 'platform', `from ${checkpointName(k)}`);
        }
    });
    const notes = [];
    const checkpoints = facts.pieceItems.length - 1;
    notes.push(`${checkpoints} checkpoint${checkpoints === 1 ? '' : 's'}`);
    const hero = cloudberryHeroNote(params);
    if (hero) notes.push(hero);
    return { items, notes };
}
