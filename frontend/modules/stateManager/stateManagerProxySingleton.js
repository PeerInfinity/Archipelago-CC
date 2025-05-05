import StateManagerProxy from './stateManagerProxy.js';
// Import the actual eventBus instance
import eventBus from '../../app/core/eventBus.js'; // Corrected path

console.log('[stateManagerProxySingleton] Creating singleton instance...');

// Pass the actual eventBus instance to the constructor
const stateManagerProxySingleton = new StateManagerProxy(eventBus);

export default stateManagerProxySingleton;
