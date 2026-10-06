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
 *
 * ⛓⛓ `rules-route-survey` — THE WHOLE ORDER. `--through=<sphere>|end` walks
 * every sphere row, so three things the five-pickup route never met:
 *  · a level holds SEVERAL route pickups (L40: four; L12: the chest and the
 *    Witch), so a goal that carries its `location` is matched by it — a goal
 *    without one keeps the level match;
 *  · an `encounter` that carries its `location` grants its `drop.item` to the
 *    steps after it (the Fire after L32) — one without keeps being skipped;
 *  · `unpresentable: 'report'` turns the refusals a boot presentation cannot
 *    honour (a Seal or a Totem Shard has no `items` row, Health adds) into a
 *    named list on the grant instead of a throw. ⚠ A staged row past such a
 *    pickup is then solved WITHOUT it, and the grant says so.
 *
 * ⛓ RULES survey-staging — **A FUSION IS NOT A LADDER.** `Ghost Sword Fusion` (`!ghostsword`) and `Fire Wand
 * Fusion` (`!firewand`) are `games/seedling.json` `fusion_items` FLAGS: the game holds the fusion's `result` once
 * the flag AND its recipe hold (`requires_items` flash items held, `requires_progressive` copies counted) — the
 * flash bridge's own reading (`flashBridgeAdapter._inventoryToFlashItems`). They were read as a progressive name,
 * found no rung and dropped as `unpresentable`, so L101's staged boots lacked `hasGhostSword`. A flag whose recipe
 * does not hold yet grants nothing and is named on the grant (`pendingFusions`).
 */

/**
 * @param {object} a
 * @param {Array<{step:number, level:number, goals:Array}>} a.earlier  the route's
 *        steps BEFORE the staged one, in order
 * @param {Array<{level:number, item:string, location:string}>} a.pickups  the
 *        route pickups (`ROUTE_PICKUPS`: AP's own sphere rows)
 * @param {object} a.game  `games/seedling.json` (`ap_items`, `progressive_items`, `items`)
 * @param {object} a.latchItems  the staging's `seam.items` (what the latch holds)
 * @param {'throw'|'report'} [a.unpresentable='throw']  `report` lists what a boot
 *        presentation cannot honour on the grant (`unpresentable`) instead of throwing
 * @returns {{keys:number[], items:string[], latched:string[],
 *            from:Array<{step:number, item:string, grants:string}>}|null}
 *          `null` when no earlier step collected anything
 */
export function deriveStagedGrant({ earlier, pickups, game, latchItems, unpresentable = 'throw' }) {
    const keys = new Set();
    const items = new Set();
    const latched = new Set();
    const from = [];
    const cannot = [];
    const copies = new Map();
    /** flash names the walk holds (granted or latched), for a fusion's `requires_items` */
    const heldFlash = new Set(game.items.filter((r) => latchItems?.[r.property] === true).map((r) => r.flash_name));
    /** fusion flag → the step and AP item that delivered it */
    const fusionFlags = new Map();
    const isFusionFlag = (flash) => (game.fusion_items ?? []).some((f) => (f.requires_flags ?? []).includes(flash));
    const refuse = (step, item, message) => {
        if (unpresentable !== 'report') throw new Error(message);
        cannot.push({ step, item, why: message.replace(/^surveyGrants: /, '') });
    };
    const grantRow = (step, item, row) => {
        if (latchItems?.[row.property] === true) {
            latched.add(row.property);
            from.push({ step, item, grants: `latched ${row.property}` });
        } else {
            items.add(row.property);
            from.push({ step, item, grants: `seam.items.${row.property}` });
        }
    };
    for (const s of earlier) {
        for (const g of s.goals) {
            const drop = g.kind === 'encounter' && g.location;
            if (g.kind !== 'collect-placement' && !drop) continue;
            const pick = g.location
                ? pickups.find((p) => p.location === g.location)
                : pickups.find((p) => p.level === s.level);
            if (!pick) {
                throw new Error(`surveyGrants: step ${s.step} (L${s.level}) collects a placement `
                    + 'no route pickup names — the grant cannot be derived from a pickup it '
                    + 'cannot identify.');
            }
            const ap = game.ap_items.find((r) => r.ap_name === pick.item);
            if (!ap) throw new Error(`surveyGrants: AP item '${pick.item}' is not in ap_items`);
            let flash = ap.flash_name;
            if (isFusionFlag(flash)) {
                if (!fusionFlags.has(flash)) fusionFlags.set(flash, { step: s.step, item: pick.item });
                continue;
            }
            if (flash.startsWith('!')) {
                const n = (copies.get(flash) ?? 0) + 1;
                copies.set(flash, n);
                const ladder = game.progressive_items[flash];
                if (!ladder || !ladder[n - 1]) {
                    refuse(s.step, pick.item, `surveyGrants: progressive '${flash}' copy ${n} has no rung `
                        + `(progressive_items: ${JSON.stringify(ladder ?? null)})`);
                    continue;
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
            if (!row) {
                refuse(s.step, pick.item, `surveyGrants: flash item '${flash}' is not in items`);
                continue;
            }
            if (row.value !== true || row.op !== undefined) {
                refuse(s.step, pick.item, `surveyGrants: '${flash}' → ${row.property} is not a boolean `
                    + `grant (${JSON.stringify(row)}) — a boot presentation declares a flag, it `
                    + 'cannot add.');
                continue;
            }
            heldFlash.add(flash);
            grantRow(s.step, pick.item, row);
        }
    }
    const pending = [];
    for (const fusion of game.fusion_items ?? []) {
        const flags = fusion.requires_flags ?? [];
        if (flags.length === 0 || !flags.every((f) => fusionFlags.has(f))) continue;
        const via = fusionFlags.get(flags[flags.length - 1]);
        const missing = [
            ...(fusion.requires_items ?? []).filter((it) => !heldFlash.has(it)),
            ...Object.entries(fusion.requires_progressive ?? {})
                .filter(([group, need]) => (copies.get(group) ?? 0) < need).map(([group, need]) => `${group}×${need}`),
        ];
        if (missing.length > 0) {
            pending.push({ step: via.step, item: via.item, result: fusion.result, missing });
            continue;
        }
        const row = game.items.find((r) => r.flash_name === fusion.result);
        if (!row || row.value !== true || row.op !== undefined) {
            refuse(via.step, via.item, `surveyGrants: fusion result '${fusion.result}' is not a boolean item `
                + `(${JSON.stringify(row ?? null)})`);
            continue;
        }
        heldFlash.add(fusion.result);
        grantRow(via.step, via.item, row);
    }
    if (from.length === 0 && cannot.length === 0 && pending.length === 0) return null;
    return {
        keys: [...keys].sort((x, y) => x - y),
        items: [...items].sort(),
        latched: [...latched].sort(),
        from,
        ...(unpresentable === 'report' ? { unpresentable: cannot } : {}),
        ...(pending.length > 0 ? { pendingFusions: pending } : {}),
    };
}

/**
 * ⛓ RULES survey-staging — **A COMMITTED TAPE BOOTS ONLY THE VISIT IT PRESENTS.** The survey matches a committed
 * campaign tape by arrival position, so a LATE return to the same door (L3@64,16 at step 217, leg 10.2) booted the
 * tape's early block verbatim: no sword. A tape boots a visit only while it presents everything the walk holds
 * there — `grant` is `deriveStagedGrant` over the walk's earlier steps with the TAPE's own `seam.items` as the
 * latch, so the tape covers the visit when the grant writes no item and every key it names is in the tape's own
 * `save.keys`. Otherwise the visit is later than the tape's own (the caller boots it staged, with the derived grant)
 * — never the tape's block with a late inventory grafted on, which no run ever recorded. What a boot can never
 * present (`unpresentable`) does not count against the tape.
 *
 * @returns {{covers: boolean, beyond: string[]}} `beyond` names what the walk holds that the tape does not
 */
export function tapeCoversVisit(grant, tapeKeys = []) {
    if (!grant) return { covers: true, beyond: [] };
    const beyond = [
        ...grant.items,
        ...grant.keys.filter((k) => !tapeKeys.includes(k)).map((k) => `save.keys[${k}]`),
    ];
    return { covers: beyond.length === 0, beyond };
}
