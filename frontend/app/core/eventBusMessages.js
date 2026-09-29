// eventBusMessages.js
//
// The words the event bus logs when a subscriber throws — kept in their own
// dependency-free module so the Playwright spec (test_json/e2e/app.spec.js,
// via scripts/test/inAppSummary.js) can import the SAME phrase it gates on.
// A gate that greps a copy of the string goes silently green the day the
// catch is reworded; one that imports it cannot.

/** The fixed start of every "a subscriber threw" line (eventBus.publish's catch). */
export const HANDLER_ERROR_PHRASE = 'Error in event handler for';

/** The whole line eventBus.publish logs for a subscriber that threw. */
export function handlerErrorMessage(event, moduleName) {
  return `${HANDLER_ERROR_PHRASE} ${event} (module: ${moduleName}):`;
}
