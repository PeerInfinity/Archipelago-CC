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
 * completed before · loop 1   ← AN-TIME-2: first performed in an EARLIER loop (⚖ Q6: a "loop N" tag, not grey)
 * available 12:00–13:00       ← AN-TIME-2, a windowed world only: the node's window ("any time" without one)
 * 5 mana                      ← the live price (region-XP discounted), in the world's pool name ("1 h")
 * click: waits 1 h (opens 12:00), then 1 h   ← AN-TIME-2: what a click queues when the node is early
 * needs  –                    ← minimums; the unmet line is marked when the node is blocked
 * gives  Gold +3
 * [perform all remaining]     ← AN-3b: `.an-card__actions[data-slot="perform-all-remaining"]`, on a node whose limit > 1
 * ```
 *
 * and takes its state's styling (`data-state` = `nodeStates.js`'s state; the border colour). The state is the one
 * `runtime.nodeStates` computes: for the END of the Loops queue while it is planned, the live state while it runs.
 *
 * ⛓ THE BUTTON (AN-3b, ⚖ Robert 2026-11-17T21:35:22Z: "a separate button on the repeatable nodes to perform all
 * remaining"): a node whose limit is greater than 1 gets ONE button, "Perform all remaining", in the reserved slot. It
 * calls the provider's `onPerformAll(nodeId)` (`nodeClickAction.performNode` with `times: 'remaining'`: the route,
 * then the remaining performances, capped by the end-of-queue state). Its answer (queued, performed, capped, or the
 * refusal by name) is the card's `.an-card__message` line until the next answer for that node or a world switch. The
 * button is the card's only listener; the click on the card's body is the Region Graph's (the overlay manager runs the
 * panel's click actions, where `actionNodes.act` performs ONCE), and a BUTTON is excluded from that handler.
 *
 * ⛓ DISCOVERY HOLDS. A node whose region is undiscovered shows the discovery placeholder (`???`), never its contents;
 * one with no way in from a discovered node is not drawn at all (the graph hides it too:
 * `regionView/regionViewModel.js` `regionDiscovery` — the same rule, over the node's own exits).
 *
 * `nodeCardModel` and `cardVisibility` are pure (tested in node); `renderNodeCard` / `updateNodeCard` need a document.
 */

import { NODE_STATES } from './nodeStates.js';
import { formatClock, poolAmountOf, poolNameOf, unitAmountOf } from './actionModel.js';

/** The "completed before" marker's text (AN-TIME-2, ⚖ Robert's Q6: a tag naming the loop, not a grey card). */
export const completedBeforeText = (loop) => `completed before · loop ${loop}`;

/**
 * A node's window line (AN-TIME-2) on the world's clock: "available 12:00–13:00", "available until 10:00",
 * "available from 12:00", or "any time".
 */
export function windowText(model, window) {
    const from = typeof window?.from === 'number' ? formatClock(model, window.from) : null;
    const until = typeof window?.until === 'number' ? formatClock(model, window.until) : null;
    if (from && until) return `available ${from}–${until}`;
    if (until) return `available until ${until}`;
    if (from) return `available from ${from}`;
    return 'any time';
}

/** The slot of the "perform all remaining" button (⚖ Robert 2026-11-17T21:35:22Z; AN-3a reserved it, AN-3b fills it). */
export const PERFORM_ALL_SLOT = 'perform-all-remaining';
export const PERFORM_ALL_LABEL = 'Perform all remaining';
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
const givesOf = (payload, model) => {
    const parts = [
        amountsText(payload.results?.stats, (v) => `${v.name} ${v.amount > 0 ? '+' : ''}${v.amount}`),
        amountsText(payload.results?.resources, (v) => `${v.name} ${v.amount > 0 ? '+' : ''}${v.amount}`),
    ].filter((t) => t !== '–');
    if (payload.results?.mana) parts.push(`${model ? poolNameOf(model) : 'Mana'} +${payload.results.mana}`);
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
 * @param {string|null} [input.message]  the last "perform all remaining" answer for this node
 * @param {object} [input.model]     the runtime model (AN-TIME-2: its clock, windows and pool name)
 * @param {number|null} [input.completedBefore]  the earlier loop this node was first performed in, or null
 * @returns {object|null} null: not drawn
 */
export function nodeCardModel({ payload, state, visibility = 'shown', checked = false, message = null, model = null,
    completedBefore = null }) {
    if (!payload || !state || visibility === 'hidden') return null;
    const nodeId = payload.node_id;
    if (visibility === 'placeholder' || state.state === NODE_STATES.UNDISCOVERED) {
        return { nodeId, placeholder: true, state: NODE_STATES.UNDISCOVERED, title: PLACEHOLDER_TEXT };
    }
    const isStart = payload.kind === 'start';
    const unmetCode = state.unmet?.code ?? null;
    const windowed = !!model?.windowed && !isStart;
    const wait = state.wait ?? 0;
    const time = {};
    if (windowed) time.window = windowText(model, payload.window);
    if (windowed && wait > 0 && state.state === NODE_STATES.READY) {
        time.click = `click: waits ${unitAmountOf(model, wait)} (opens ${formatClock(model, payload.window.from)}), then ${poolAmountOf(model, state.price)}`;
    }
    if (completedBefore !== null && completedBefore !== undefined && !isStart) time.completedBefore = completedBeforeText(completedBefore);
    const unmetLine = unmetCode === 'mana' ? 'mana' : unmetCode === 'too-late' ? 'window'
        : (/below 0/.test(state.unmet?.text ?? '') ? 'gives' : 'needs');
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
        message: message ?? null,
        mana: isStart ? null : (model ? poolAmountOf(model, state.price) : `${manaText(state.price)} mana`),
        needs: needsOf(payload),
        gives: givesOf(payload, model),
        // The unmet line: a requirement marks `needs`; a resource that would go below 0 marks `gives`; mana marks `mana`;
        // too late (AN-TIME-2) marks the window line.
        unmet: state.unmet ? { line: unmetLine, text: state.unmet.text } : null,
        ...time,
    };
}

function line(doc, cls, text, attrs = {}) {
    const e = doc.createElement('div');
    e.className = cls;
    e.textContent = text;
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
}

/**
 * Fill `el` (the card root) from a card model. `onPerformAll(nodeId)` (optional) is what the button calls; it is kept
 * on the element, so an in-place update re-binds nothing.
 */
export function updateNodeCard(el, card, { onPerformAll = null } = {}) {
    if (onPerformAll) el._anOnPerformAll = onPerformAll;
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
    if (card.completedBefore) {
        const tag = line(doc, 'an-card__completed-before', card.completedBefore);
        tag.style.cssText = 'color:#9ecbff;font-style:italic;';
        el.appendChild(tag);
    }
    const mark = (name, e) => {
        if (card.unmet?.line === name) {
            e.classList.add('an-card__unmet');
            e.style.color = '#e0a030';
            e.title = card.unmet.text;
        }
        return e;
    };
    if (card.window) el.appendChild(mark('window', line(doc, 'an-card__window', card.window)));
    if (card.mana) el.appendChild(mark('mana', line(doc, 'an-card__mana', card.mana)));
    el.appendChild(mark('needs', line(doc, 'an-card__needs', `needs  ${card.needs}`)));
    el.appendChild(mark('gives', line(doc, 'an-card__gives', `gives  ${card.gives}`)));
    if (card.click) el.appendChild(line(doc, 'an-card__click', card.click));
    if (card.unmet) el.appendChild(line(doc, 'an-card__why', card.unmet.text));
    // ⛓ The "perform all remaining" button of a repeatable node (limit > 1); the slot stays empty and hidden otherwise.
    const slot = line(doc, 'an-card__actions', '', { 'data-slot': PERFORM_ALL_SLOT });
    if (card.repeatable) {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'an-card__perform-all';
        btn.textContent = PERFORM_ALL_LABEL;
        btn.dataset.nodeId = card.nodeId;
        btn.style.cssText = 'font:inherit;margin-top:2px;padding:0 4px;cursor:pointer;';
        btn.addEventListener('mousedown', (e) => e.stopPropagation());
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            el._anOnPerformAll?.(card.nodeId);
        });
        slot.appendChild(btn);
    } else {
        slot.style.display = 'none';
    }
    el.appendChild(slot);
    if (card.message) el.appendChild(line(doc, 'an-card__message', card.message));
    return el;
}

/** A new card element for a card model. */
export function renderNodeCard(card, doc = globalThis.document, opts = {}) {
    const el = doc.createElement('div');
    el.className = 'an-node-card';
    el.style.cssText = 'width:120px;box-sizing:border-box;padding:3px 5px;border:2px solid;border-radius:4px;'
        + 'font:10px/1.25 sans-serif;color:#ddd;pointer-events:auto;';
    return updateNodeCard(el, card, opts);
}

/**
 * The overlay provider. `getView()` returns `{loaded, model, payloads, states, isDiscovered, checked}` or null; it is
 * computed once per refresh (memoised until the next microtask), not once per node. `getStamp()` (the runtime's model
 * object) invalidates the memo at once when the world changes inside one task.
 * `onPerformAll(nodeId)` (AN-3b) runs the button and returns its answer (`{text}`), shown on that node's card.
 * @param {{getView: () => object|null, getStamp?: () => unknown, document?: Document,
 *   onPerformAll?: (nodeId: string) => {text?: string}|null, onAnswered?: () => void}} deps
 */
export function createNodeCardProvider({ getView, getStamp = () => null, document: doc = globalThis.document,
    onPerformAll = null, onAnswered = () => {} }) {
    let memo = null;
    let stamp;
    const messages = new Map(); // nodeId → the last button answer's text (this world only)
    let messagesStamp;
    const performAll = onPerformAll ? (nodeId) => {
        const r = onPerformAll(nodeId);
        messages.set(nodeId, r?.text ?? null);
        memo = null;
        onAnswered();
        return r;
    } : null;
    const view = () => {
        const now = getStamp();
        if (now !== messagesStamp) { messages.clear(); messagesStamp = now; }
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
            message: messages.get(nodeId) ?? null,
            model: v.model,
            completedBefore: v.completedBefore?.(nodeId) ?? null,
        });
    };
    return {
        create(nodeId) {
            const v = view();
            if (!v.loaded || !v.payloads?.[nodeId]) return null; // Menu, or another world's region: no card
            return renderNodeCard(cardOf(nodeId), doc, { onPerformAll: performAll });
        },
        update(nodeId, _nodeData, el) {
            updateNodeCard(el, cardOf(nodeId), { onPerformAll: performAll });
        },
        /** Tests: run the button's effect for a node as a click on it would. */
        performAll,
    };
}
