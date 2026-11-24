/**
 * The Console panel's tab marker for a waiting offline-progress offer.
 *
 * An offer can appear while the Console is another tab (mainly after an automatic
 * reconnect while the player is on the game tab). Its bar lives inside the panel,
 * so nothing would say it is waiting. While an offer is open AND the panel is not
 * visible, its tab carries " •" after the title and the tab's tooltip says why.
 *
 * ⛔ DOM ONLY, NEVER `container.setTitle`: Golden Layout's setTitle writes the
 * item's title into the layout config (it emits `stateChanged`), so a layout saved
 * while an offer waited would carry the marker into the next load. The marker is a
 * class on the tab element plus a sibling span after `.lm_title` (which GL's own
 * setTitle, `innerText` on the title span, never touches). There is no title to
 * remember or restore.
 *
 * Rule: marked = an offer is open (`getOffer()` non-null) AND `container.visible`
 * is false. A panel shown side by side with the game is visible, so not marked.
 * Showing the panel hides the marker only while it shows; switching away with the
 * offer unanswered brings it back. Only an answer (Send / Not now / Discard) or the
 * offer closing any other way ends it. Never activates a tab or moves focus.
 */

export const OFFER_TAB_CLASS = 'offline-offer-pending';
export const OFFER_MARKER_CLASS = 'offline-offer-marker';
export const OFFER_MARKER_TEXT = ' •';
export const OFFER_TOOLTIP_SUFFIX = ' — offline progress waiting';

/**
 * @param {object} opts
 * @param {object} opts.container  the Golden Layout ComponentContainer (`visible`, `tab`, `on`, `off`)
 * @param {object} opts.bus        an event bus with subscribe(event, cb) / unsubscribe(event, cb)
 * @param {() => object|null} opts.getOffer the open offer, or null
 * @returns {{ update: () => void, dispose: () => void, isMarked: () => boolean }}
 */
export function createOfferTabMarker({ container, bus, getOffer }) {
  let disposed = false;
  // The tab currently marked, and its tooltip attribute as it was before marking.
  let marked = null; // { tab, hadTitle, title }

  const unmark = () => {
    if (!marked) return;
    const el = marked.tab?.element;
    if (el) {
      el.classList.remove(OFFER_TAB_CLASS);
      for (const span of el.querySelectorAll(`:scope > .${OFFER_MARKER_CLASS}`)) span.remove();
      // Restore the tooltip only if it is still ours (GL's setTitle may have reset it meanwhile).
      if (el.getAttribute('title') === `${marked.title}${OFFER_TOOLTIP_SUFFIX}`) {
        if (marked.hadTitle) el.setAttribute('title', marked.title);
        else el.removeAttribute('title');
      }
    }
    marked = null;
  };

  const mark = (tab) => {
    const el = tab.element;
    const hadTitle = el.hasAttribute('title');
    const title = el.getAttribute('title') ?? '';
    el.classList.add(OFFER_TAB_CLASS);
    if (!el.querySelector(`:scope > .${OFFER_MARKER_CLASS}`)) {
      const span = el.ownerDocument.createElement('span');
      span.className = OFFER_MARKER_CLASS;
      span.textContent = OFFER_MARKER_TEXT;
      span.setAttribute('aria-hidden', 'true');
      span.style.cssText = 'color: #ffb366; font-weight: bold; white-space: pre; pointer-events: none;';
      const titleEl = tab.titleElement ?? el.querySelector('.lm_title');
      if (titleEl && titleEl.parentNode === el) titleEl.after(span);
      else el.prepend(span);
    }
    el.setAttribute('title', `${title}${OFFER_TOOLTIP_SUFFIX}`);
    marked = { tab, hadTitle, title };
  };

  const update = () => {
    if (disposed) return;
    const tab = container?.tab;
    const want = Boolean(getOffer?.()) && container?.visible === false && Boolean(tab?.element);
    if (!want) {
      unmark();
      return;
    }
    if (marked?.tab === tab) return;
    unmark();
    mark(tab);
  };

  const onEvent = () => update();
  const busEvents = ['client:offlineProgressOffer', 'client:offlineProgressOfferClosed'];
  // The offer events are published synchronously before/after `_offlineOffer` changes;
  // `getOffer()` is read at handling time, so both orders converge.
  for (const ev of busEvents) bus?.subscribe?.(ev, onEvent);
  // 'tab': GL made a new Tab (the panel was dragged to another stack).
  const containerEvents = ['show', 'hide', 'tab'];
  for (const ev of containerEvents) container?.on?.(ev, onEvent);

  update();

  return {
    update,
    isMarked: () => marked !== null,
    dispose() {
      if (disposed) return;
      unmark();
      disposed = true;
      for (const ev of busEvents) bus?.unsubscribe?.(ev, onEvent);
      for (const ev of containerEvents) container?.off?.(ev, onEvent);
    },
  };
}
