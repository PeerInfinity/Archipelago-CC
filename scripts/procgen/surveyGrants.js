/**
 * ⛓⛓ SEEDLING SWIM U2, D3 — **THE STAGED GRANT IS DERIVED, NOT TYPED**
 * (⚖ Q26, 2026-09-30: "derive it").
 *
 * A staged survey row boots from `STAGED_BASE`, the campaign's post-sword latch,
 * which predates every pickup the extended legs collect. So a staged room after
 * the Red Key, the Shield or the Green Key refused on a lock the route had
 * already earned the key for (U1 § D4: step 24 on `shieldlocknorm`, step 28 on
 * a keylock). T3 and U1 each carried ONE hand row; this is the derivation that
 * replaces it:
 *
 *   for a staged step, the union of every `collect-placement` the route
 *   completed at an EARLIER step, each mapped AP item name → `ap_items`'
 *   `flash_name` → (a progressive name counts its copies through
 *   `progressive_items`) → either a Boss Key (`key<N>`, keyType N, the v6
 *   `save.keys` block) or an item (`items[].property`, the v8
 *   `seam.items.<property>` block — `watchSolve.ITEM_FORM_FIELDS`' door).
 *
 * ⚠ An item the latch ALREADY holds is reported as `latched`, never written a
 * second time — and the latch is post-sword, so the Sword MUST be one of them
 * (asserted by the caller). An item whose property is not a boolean (`health`,
 * `op: "add"`) refuses by name: a boot presentation cannot add.
 *
 * Pure: every input is handed in, so the unit rows (`surveyGrants.test.js`) run
 * without the survey's route derivation.
 */

/**
 * @param {object} a
 * @param {Array<{step:number, level:number, goals:Array}>} a.earlier  the route's
 *        steps BEFORE the staged one, in order
 * @param {Array<{level:number, item:string, location:string}>} a.pickups  the
 *        route pickups (`ROUTE_PICKUPS`: AP's own sphere rows)
 * @param {object} a.game  `games/seedling.json` (`ap_items`, `progressive_items`, `items`)
 * @param {object} a.latchItems  the staging's `seam.items` (what the latch holds)
 * @returns {{keys:number[], items:string[], latched:string[],
 *            from:Array<{step:number, item:string, grants:string}>}|null}
 *          `null` when no earlier step collected anything
 */
export function deriveStagedGrant({ earlier, pickups, game, latchItems }) {
    const keys = new Set();
    const items = new Set();
    const latched = new Set();
    const from = [];
    const copies = new Map();
    for (const s of earlier) {
        for (const g of s.goals) {
            if (g.kind !== 'collect-placement') continue;
            const pick = pickups.find((p) => p.level === s.level);
            if (!pick) {
                throw new Error(`surveyGrants: step ${s.step} (L${s.level}) collects a placement `
                    + 'no route pickup names — the grant cannot be derived from a pickup it '
                    + 'cannot identify.');
            }
            const ap = game.ap_items.find((r) => r.ap_name === pick.item);
            if (!ap) throw new Error(`surveyGrants: AP item '${pick.item}' is not in ap_items`);
            let flash = ap.flash_name;
            if (flash.startsWith('!')) {
                const n = (copies.get(flash) ?? 0) + 1;
                copies.set(flash, n);
                const ladder = game.progressive_items[flash];
                if (!ladder || !ladder[n - 1]) {
                    throw new Error(`surveyGrants: progressive '${flash}' copy ${n} has no rung `
                        + `(progressive_items: ${JSON.stringify(ladder ?? null)})`);
                }
                flash = ladder[n - 1];
            }
            const key = /^key(\d+)$/.exec(flash);
            if (key) {
                keys.add(Number(key[1]));
                from.push({ step: s.step, item: pick.item, grants: `save.keys[${key[1]}]` });
                continue;
            }
            const row = game.items.find((r) => r.flash_name === flash);
            if (!row) throw new Error(`surveyGrants: flash item '${flash}' is not in items`);
            if (row.value !== true || row.op !== undefined) {
                throw new Error(`surveyGrants: '${flash}' → ${row.property} is not a boolean `
                    + `grant (${JSON.stringify(row)}) — a boot presentation declares a flag, it `
                    + 'cannot add.');
            }
            if (latchItems?.[row.property] === true) {
                latched.add(row.property);
                from.push({ step: s.step, item: pick.item, grants: `latched ${row.property}` });
            } else {
                items.add(row.property);
                from.push({ step: s.step, item: pick.item, grants: `seam.items.${row.property}` });
            }
        }
    }
    if (from.length === 0) return null;
    return {
        keys: [...keys].sort((x, y) => x - y),
        items: [...items].sort(),
        latched: [...latched].sort(),
        from,
    };
}
