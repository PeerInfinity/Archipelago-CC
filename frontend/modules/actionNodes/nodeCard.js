/**
 * actionNodes/nodeCard — **THE NODE CARD** on the Region Graph (design §4 "The node card"; slice AN-3a).
 *
 * The card is a Region Graph node overlay (`regionGraph/nodeOverlayManager.js`'s provider interface,
 * `{create(nodeId, nodeData), update(nodeId, nodeData, el)}`), registered by `actionNodes/index.js` while an ActionNodes
 * world is loaded and unregistered on unload (`regionGraph` public `registerNodeOverlayProvider` /
 * `unregisterNodeOverlayProvider`). It shows:
 *
 * ```
 * Do Chores        ✓ 0/2      ← name, a check mark once its location is checked (🏁 on the goal), used/limit
 * 5 mana                      ← the live price (region-XP discounted)
 * needs  –                    ← minimums; the unmet line is marked when the node is blocked
 * gives  Gold +3
 * [perform all remaining]     ← RESERVED, empty: `.an-card__actions[data-slot="perform-all-remaining"]` (AN-3b)
 * ```
 *
 * and takes its state's styling (`data-state` = `nodeStates.js`'s state; the border colour). The state is the one
 * `runtime.nodeStates` computes: for the END of the Loops queue while it is planned, the live state while it runs.
 *
 * ⛔ No click code (the click is AN-3b, after the click-actions series): the card adds no listener. The overlay
 * manager's own handlers (drag forwarding; a click selects the region) stay as they are.
 *
 * ⛓ DISCOVERY HOLDS. A node whose region is undiscovered shows the discovery placeholder (`???`), never its contents;
 * one with no way in from a discovered node is not drawn at all (the graph hides it too:
 * `regionView/regionViewModel.js` `regionDiscovery` — the same rule, over the node's own exits).
 *
 * `nodeCardModel` and `cardVisibility` are pure (tested in node); `renderNodeCard` / `updateNodeCard` need a document.
 */

import { NODE_STATES } from './nodeStates.js';

/** The reserved slot for AN-3b's "perform all remaining" button (⚖ Robert 2026-11-17T21:35:22Z). */
export const PERFORM_ALL_SLOT = 'perform-all-remaining';
export const CHECK_MARK = '✓';
export const GOAL_MARK = '🏁';
export const PLACEHOLDER_TEXT = '???';

/** The border colour of each state (the Region Graph's own palette: accessible green, inaccessible grey…). */
export const STATE_STYLE = Object.freeze({
    [NODE_STATES.READY]: Object.freeze({ border: '#52b845', background: '#1f2d1d', opacity: '1' }),
    [NODE_STATES.BLOCKED]: Object.freeze({ border: '#e0a030', background: '#2d2614', opacity: '1' }),
    [NODE_STATES.NOT_REACHED]: Object.freeze({ border: '#8e8e8e', background: '#222', opacity: '0.7' }),
    [NODE_STATES.DONE]: Object.freeze({ border: '#6c5ce7', background: '#221f33', opacity: '0.85' }),
    [NODE_STATES.UNDISCOVERED]: Object.freeze({ border: '#444', background: '#1a1a1a', opacity: '0.8' }),
});

const amountsText = (named, fmt) => {
    const parts = Object.values(named ?? {}).map(fmt);
    return parts.length ? parts.join(', ') : '–';
};
const givesOf = (payload) => {
    const parts = [
        amountsText(payload.results?.stats, (v) => `${v.name} ${v.amount > 0 ? '+' : ''}${v.amount}`),
        amountsText(payload.results?.resources, (v) => `${v.name} ${v.amount > 0 ? '+' : ''}${v.amount}`),
    ].filter((t) => t !== '–');
    if (payload.results?.mana) parts.push(`Mana +${payload.results.mana}`);
    return parts.length ? parts.join(', ') : '–';
};
const needsOf = (payload) => {
    const parts = [
        amountsText(payload.requires?.stats, (v) => `${v.name} ${v.amount}`),
        amountsText(payload.requires?.resources, (v) => `${v.name} ${v.amount}`),
    ].filter((t) => t !== '–');
    return parts.length ? parts.join(', ') : '–';
};
const manaText = (m) => {
    const r = Math.round(m * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/**
 * 'shown' | 'placeholder' | 'hidden': the node's discovery standing, by the view model's rule over the node exits
 * (`Menu → start` included as the start's way in).
 * @param {object} model - the runtime model (nodes with `exits`)
 * @param {string} nodeId
 * @param {(id: string) => boolean} isDiscovered
 */
export function cardVisibility(model, nodeId, isDiscovered) {
    if (isDiscovered(nodeId)) return 'shown';
    if (nodeId === model.nodes[model.startIndex]?.id) return 'placeholder';
    const enteredFromDiscovered = model.nodes.some((n) => isDiscovered(n.id) && n.exits.some((e) => e.target === nodeId));
    return enteredFromDiscovered ? 'placeholder' : 'hidden';
}

/**
 * The card's content as data.
 * @param {object} input
 * @param {object} input.payload     the node's `playable_payload`
 * @param {object} input.state       its `nodeStates` entry `{state, unmet, count, limit, price}`
 * @param {string} input.visibility  `cardVisibility`
 * @param {boolean} input.checked    its location is checked
 * @returns {object|null} null: not drawn
 */
export function nodeCardModel({ payload, state, visibility = 'shown', checked = false }) {
    if (!payload || !state || visibility === 'hidden') return null;
    const nodeId = payload.node_id;
    if (visibility === 'placeholder' || state.state === NODE_STATES.UNDISCOVERED) {
        return { nodeId, placeholder: true, state: NODE_STATES.UNDISCOVERED, title: PLACEHOLDER_TEXT };
    }
    const isStart = payload.kind === 'start';
    const unmetCode = state.unmet?.code ?? null;
    return {
        nodeId,
        placeholder: false,
        state: state.state,
        title: payload.name,
        kind: payload.kind,
        goal: payload.kind === 'goal',
        location: payload.location ?? null,
        checked: !!payload.location && !!checked,
        used: isStart ? null : `${state.count}/${state.limit}`,
        repeatable: payload.limit > 1,
        mana: isStart ? null : `${manaText(state.price)} mana`,
        needs: needsOf(payload),
        gives: givesOf(payload),
        // The unmet line: a requirement marks `needs`; a resource that would go below 0 marks `gives`; mana marks `mana`.
        unmet: state.unmet ? { line: unmetCode === 'mana' ? 'mana' : (/below 0/.test(state.unmet.text) ? 'gives' : 'needs'), text: state.unmet.text } : null,
    };
}

function line(doc, cls, text, attrs = {}) {
    const e = doc.createElement('div');
    e.className = cls;
    e.textContent = text;
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
}

/** Fill `el` (the card root) from a card model. */
export function updateNodeCard(el, card) {
    const doc = el.ownerDocument;
    el.replaceChildren();
    const st = STATE_STYLE[card?.state] ?? STATE_STYLE[NODE_STATES.NOT_REACHED];
    el.style.borderColor = st.border;
    el.style.background = st.background;
    el.style.opacity = st.opacity;
    if (!card) { el.style.display = 'none'; return el; }
    el.style.display = '';
    el.dataset.state = card.state;
    el.dataset.nodeCard = card.nodeId;
    if (card.placeholder) {
        el.appendChild(line(doc, 'an-card__title an-card__placeholder', card.title));
        return el;
    }
    const head = doc.createElement('div');
    head.className = 'an-card__head';
    head.style.cssText = 'display:flex;justify-content:space-between;gap:4px;font-weight:bold;';
    head.appendChild(line(doc, 'an-card__title', card.title));
    const marks = [];
    if (card.goal) marks.push(GOAL_MARK);
    if (card.checked) marks.push(CHECK_MARK);
    if (card.used) marks.push(card.used);
    head.appendChild(line(doc, 'an-card__marks', marks.join(' ')));
    el.appendChild(head);
    if (card.goal) el.appendChild(line(doc, 'an-card__goal', 'goal'));
    const mark = (name, e) => {
        if (card.unmet?.line === name) {
            e.classList.add('an-card__unmet');
            e.style.color = '#e0a030';
            e.title = card.unmet.text;
        }
        return e;
    };
    if (card.mana) el.appendChild(mark('mana', line(doc, 'an-card__mana', card.mana)));
    el.appendChild(mark('needs', line(doc, 'an-card__needs', `needs  ${card.needs}`)));
    el.appendChild(mark('gives', line(doc, 'an-card__gives', `gives  ${card.gives}`)));
    if (card.unmet) el.appendChild(line(doc, 'an-card__why', card.unmet.text));
    // ⛓ RESERVED for AN-3b: the "perform all remaining" button of a repeatable node. Empty in AN-3a.
    const slot = line(doc, 'an-card__actions', '', { 'data-slot': PERFORM_ALL_SLOT });
    slot.style.display = 'none';
    el.appendChild(slot);
    return el;
}

/** A new card element for a card model. */
export function renderNodeCard(card, doc = globalThis.document) {
    const el = doc.createElement('div');
    el.className = 'an-node-card';
    el.style.cssText = 'width:120px;box-sizing:border-box;padding:3px 5px;border:2px solid;border-radius:4px;'
        + 'font:10px/1.25 sans-serif;color:#ddd;pointer-events:auto;';
    return updateNodeCard(el, card);
}

/**
 * The overlay provider. `getView()` returns `{loaded, model, payloads, states, isDiscovered, checked}` or null; it is
 * computed once per refresh (memoised until the next microtask), not once per node. `getStamp()` (the runtime's model
 * object) invalidates the memo at once when the world changes inside one task.
 * @param {{getView: () => object|null, getStamp?: () => unknown, document?: Document}} deps
 */
export function createNodeCardProvider({ getView, getStamp = () => null, document: doc = globalThis.document }) {
    let memo = null;
    let stamp;
    const view = () => {
        const now = getStamp();
        if (memo && now === stamp) return memo;
        memo = getView() ?? { loaded: false };
        stamp = now;
        queueMicrotask(() => { memo = null; });
        return memo;
    };
    const cardOf = (nodeId) => {
        const v = view();
        if (!v.loaded || !v.payloads?.[nodeId]) return null;
        const payload = v.payloads[nodeId];
        return nodeCardModel({
            payload,
            state: v.states[nodeId],
            visibility: cardVisibility(v.model, nodeId, v.isDiscovered),
            checked: !!payload.location && v.checked(payload.location),
        });
    };
    return {
        create(nodeId) {
            const v = view();
            if (!v.loaded || !v.payloads?.[nodeId]) return null; // Menu, or another world's region: no card
            return renderNodeCard(cardOf(nodeId), doc);
        },
        update(nodeId, _nodeData, el) {
            updateNodeCard(el, cardOf(nodeId));
        },
    };
}
