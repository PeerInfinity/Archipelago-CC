/**
 * Rule-error marker — makes an exit or location whose access rule THREW
 * visible on the rendered link, without changing what it does.
 *
 * `roomAccessibility` leaves such a link passable (no softlock) and reports
 * the error in `ruleErrors`. The engine (a submodule) knows only open and
 * shut, and re-renders the whole room as `innerHTML` on every state change,
 * so the bridge re-applies the marker after each render: a class plus a
 * `title` tooltip naming the error. The link keeps its own
 * `tae-link-accessible` class and stays clickable.
 *
 * This only touches the DOM. It never logs: the console line belongs to the
 * evaluation pass (`roomAccessibility`), so a re-render does not repeat it.
 */

export const RULE_ERROR_CLASS = 'tae-link-rule-error';

const LINKS = '[data-room-id][data-exit-id], [data-room-id][data-item-id]';

/**
 * @param {Element} root  the engine's container
 * @param {Map<string, {exits: Object<string, string>, items: Object<string, string>}>} errorsByRoom
 *     the latest `roomAccessibility(...).ruleErrors` per room
 */
export function markRuleErrors(root, errorsByRoom) {
    for (const el of root.querySelectorAll(LINKS)) {
        const errors = errorsByRoom.get(el.getAttribute('data-room-id'));
        const exitId = el.getAttribute('data-exit-id');
        const message = exitId != null
            ? errors?.exits?.[exitId]
            : errors?.items?.[el.getAttribute('data-item-id')];
        if (message != null) {
            el.classList.add(RULE_ERROR_CLASS);
            el.setAttribute('title', `Access rule error (left passable): ${message}`);
        } else if (el.classList.contains(RULE_ERROR_CLASS)) {
            el.classList.remove(RULE_ERROR_CLASS);
            el.removeAttribute('title');
        }
    }
}
