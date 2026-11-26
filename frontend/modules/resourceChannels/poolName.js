/**
 * resourceChannels/poolName — **WHAT THE SHARED POOL IS CALLED IN THE LOADED WORLD** (ActionNodes AN-TIME-2, design §4).
 *
 * The pool is gameState's mana. A substrate whose world names it differently ("Time", unit "h") declares
 * `loopSupport.pool() → {name, unit} | null` on its registry entry; the Loops and Resources panels read it through the
 * loaded world's substrates (procgenPlayer's warehouse, as the Resources panel always has) and fall back to "Mana".
 * A substrate may also declare `loopSupport.clockLine(mana) → {now, left, leftText, ends} | null`: the Resources panel's
 * Time line ("Time: 11:00 · 6 h left · the day ends 17:00").
 *
 * No world declares it → every text is exactly the old "Mana" / "mana" one. The name is data, never a literal here.
 */

import { centralRegistry } from '../../app/core/centralRegistry.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

/** The pool's name when no substrate of the loaded world names one. */
export const DEFAULT_POOL = Object.freeze({ name: 'Mana', unit: '' });

/** The substrate ids of the loaded world (procgenPlayer's warehouse), or none. */
export function loadedWorldSubstrates() {
    try {
        const warehouse = centralRegistry.getPublicFunction?.('procgenPlayer', 'getWarehouse')?.();
        if (!warehouse) return [];
        return [...new Set([...warehouse.values()].map((w) => w?.substrate).filter(Boolean))].sort();
    } catch {
        return [];
    }
}

/**
 * The substrates to ask: the loaded world's, else every registered one. A substrate's `pool()` / `clockLine()` answers
 * only for ITS loaded world (null otherwise), so asking all of them is safe when the warehouse names none (a world
 * loaded in memory, before procgenPlayer has filled its warehouse).
 */
function candidatesOf(substrates, registry) {
    if (substrates.length) return substrates;
    try {
        return (registry.getAll?.() ?? []).map((e) => e?.id).filter(Boolean).sort();
    } catch {
        return [];
    }
}

/**
 * The pool of a world whose regions are of `substrates`: the first (sorted) substrate whose entry names one.
 * @param {string[]} [substrates]
 * @param {object} [registry]
 * @returns {{name: string, unit: string}}
 */
export function poolOfWorld(substrates = loadedWorldSubstrates(), registry = substrateRegistry) {
    for (const id of candidatesOf(substrates, registry)) {
        try {
            const p = registry.get(id)?.loopSupport?.pool?.();
            if (p && typeof p.name === 'string' && p.name) return { name: p.name, unit: typeof p.unit === 'string' ? p.unit : '' };
        } catch { /* a substrate's hook must not break a label */ }
    }
    return { ...DEFAULT_POOL };
}

/** The clock line of the loaded world (the first substrate that has one), or null. */
export function clockLineOfWorld(mana, substrates = loadedWorldSubstrates(), registry = substrateRegistry) {
    for (const id of candidatesOf(substrates, registry)) {
        try {
            const line = registry.get(id)?.loopSupport?.clockLine?.(mana);
            if (line) return line;
        } catch { /* ignore */ }
    }
    return null;
}

/** The pool's name inside a sentence ("mana", "time"). */
export function poolWord(pool = poolOfWorld()) {
    return pool.name.toLowerCase();
}

/** An amount of the pool in a sentence: "2 h" with a unit, else "2 mana". */
export function poolAmount(n, pool = poolOfWorld()) {
    return pool.unit ? `${n} ${pool.unit}` : `${n} ${poolWord(pool)}`;
}
