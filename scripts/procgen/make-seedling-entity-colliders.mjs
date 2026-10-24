#!/usr/bin/env node
// Seedling entity colliders — the MODEL's hitbox of every entity tag, as a
// leaf module the traversal transcription can import
// (`frontend/modules/flashPanel/seedlingEntityColliders.js`).
//
// ⛓ RULES footprints. `seedlingSemantics.ENTITY_SEMANTICS` carried each
// blocker's footprint as a hand-typed `size` in tiles, anchored at the Ogmo
// x/y. The physics model (`seedlingDemo/levelWorld.ENTITY_CLASSES`) carries
// the game's own hitbox — the constructor offset plus the `setHitbox` args —
// and the two had drifted: BeamTower sat 8 px low, the BossTotem 3 columns
// right and a row high, the Totem 2 tiles high, the Statues 2 tiles narrow.
// The transcription cannot import the model (`levelWorld.js` imports
// `seedlingSemantics.js` at evaluation time, so the edge back would be a
// cycle), so the model's rects are written here, from the model, and
// `--check` keeps the two equal.
//
// Each row is the world rect `levelWorld.entityRect(cls, 0, 0)` builds for a
// placement at the origin: `left`/`top` are `dx - originX` / `dy - originY`,
// `w`/`h` the hitbox in pixels. Rect, pixel-mask (its bounding box, the rect
// the model's planner uses) and trigger colliders are written; a class with
// no box (`none`, the per-placement `rope`) has no row.
//
// Usage:
//   node scripts/procgen/make-seedling-entity-colliders.mjs           # write the module
//   node scripts/procgen/make-seedling-entity-colliders.mjs --check   # compare, exit 1 on any difference
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { argvHelp, isEntryPoint } from './argvHelp.js';

argvHelp(import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
export const COLLIDERS_MODULE = join(REPO, 'frontend', 'modules', 'flashPanel', 'seedlingEntityColliders.js');

/** The collider kinds that carry a box. */
const BOXED = new Set(['rect', 'pixelmask', 'trigger']);

/** Every boxed `ENTITY_CLASSES` row as `{tag: {collider, left, top, w, h, src}}`, sorted by tag. */
export function modelColliders(entityClasses) {
    const out = {};
    for (const tag of Object.keys(entityClasses).sort()) {
        const cls = entityClasses[tag];
        if (!BOXED.has(cls?.collider)) continue;
        const nums = [cls.dx, cls.dy, cls.w, cls.h, cls.originX, cls.originY];
        if (!nums.every(Number.isFinite)) {
            throw new Error(`ENTITY_CLASSES.${tag} is a '${cls.collider}' collider with no finite box `
                + `(dx/dy/w/h/originX/originY = ${nums.join('/')})`);
        }
        out[tag] = {
            collider: cls.collider, left: cls.dx - cls.originX, top: cls.dy - cls.originY, w: cls.w, h: cls.h,
            src: cls.src,
        };
    }
    return out;
}

/** The module text. No timestamp, so `--check` is exact. */
export function renderColliders(colliders) {
    const rows = Object.entries(colliders).map(([tag, c]) => `    ${tag}: Object.freeze({ collider: '${c.collider}', `
        + `left: ${c.left}, top: ${c.top}, w: ${c.w}, h: ${c.h}, src: ${JSON.stringify(c.src)} }),`);
    return `/**
 * flashPanel/seedlingEntityColliders — GENERATED. Do not edit by hand.
 *
 * The physics model's hitbox of every entity tag that has one
 * (\`seedlingDemo/levelWorld.ENTITY_CLASSES\`), as the world rect of a
 * placement at the origin: the rect covers
 * \`[x + left, x + left + w) x [y + top, y + top + h)\` in pixels. A
 * pixel-mask class carries its mask's bounding box.
 *
 * \`seedlingSemantics\` reads its footprints from here, so the traversal
 * transcription seals exactly the tiles the game's hitbox covers. It cannot
 * import the model itself: \`levelWorld.js\` imports \`seedlingSemantics.js\`
 * at evaluation time, and the edge back would be a cycle.
 *
 * Regenerate + verify:
 *   node scripts/procgen/make-seedling-entity-colliders.mjs
 *   node scripts/procgen/make-seedling-entity-colliders.mjs --check
 */

export const ENTITY_COLLIDERS = Object.freeze({
${rows.join('\n')}
});
`;
}

async function main() {
    const { ENTITY_CLASSES } = await import(join(REPO, 'frontend', 'modules', 'seedlingDemo', 'levelWorld.js'));
    const rendered = renderColliders(modelColliders(ENTITY_CLASSES));
    if (process.argv.includes('--check')) {
        if (!existsSync(COLLIDERS_MODULE)) {
            console.error(`--check: ${COLLIDERS_MODULE} does not exist yet`);
            process.exit(1);
        }
        if (readFileSync(COLLIDERS_MODULE, 'utf8') !== rendered) {
            console.error('--check: seedlingEntityColliders.js differs from the model\'s ENTITY_CLASSES — '
                + 'run make-seedling-entity-colliders.mjs');
            process.exit(1);
        }
        console.log(`--check: ${Object.keys(modelColliders(ENTITY_CLASSES)).length} colliders, exact`);
        return;
    }
    writeFileSync(COLLIDERS_MODULE, rendered);
    console.log(`wrote ${COLLIDERS_MODULE}`);
}

if (isEntryPoint(import.meta.url)) await main();
