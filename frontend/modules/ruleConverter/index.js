// Rule Format Converter Module
// Converts between Python code and Archipelago-CC JSON rule format using Pyodide

import RuleConverterUI from './ruleConverterUI.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('ruleConverter', message, ...data);
  } else {
    const consoleMethod = console[level === 'info' ? 'log' : level] || console.log;
    consoleMethod(`[ruleConverter] ${message}`, ...data);
  }
}

// --- Module Info ---
export const moduleInfo = {
  name: 'ruleConverter',
  title: 'Rule Converter',
  componentType: 'ruleConverterPanel',
  icon: '\u{1F504}', // Counterclockwise arrows emoji
  column: 2,
  description: 'Convert between Python code and JSON rule format.',
};

/**
 * Registration function for the Rule Converter module.
 * Registers the converter panel component.
 */
export function register(registrationApi) {
  log('info', '[Rule Converter] Registering...');
  registrationApi.registerPanelComponent('ruleConverterPanel', RuleConverterUI);

  // Register event publishers
  registrationApi.registerEventBusPublisher('ruleConverter:conversionComplete');
  registrationApi.registerEventBusPublisher('ruleConverter:conversionError');
  registrationApi.registerEventBusPublisher('ruleConverter:stateChanged');
  registrationApi.registerEventBusPublisher('ruleConverter:pyodideLoaded');
}
