/**
 * Converter Service
 *
 * The Quick engine: pure JavaScript implementations, instant and offline.
 * They handle the most common rule patterns. The panel's Exact engine runs
 * the real exporter under Pyodide instead (../helperScript/helperScript.js).
 */

import { convertJsonToPython, convertJsonToLambda, convertJsonToFunction } from './jsonToPython.js';
import { convertPythonToJson } from './pythonToJson.js';

/**
 * Converter service singleton
 */
class ConverterService {
  constructor() {
    this.isReady = true;
  }

  /**
   * Get status of the converter
   */
  getStatus() {
    return { status: 'ready' };
  }

  /**
   * Convert Python code to JSON rule
   * @param {string} code - Python code to convert
   * @returns {Object} Result with success, rule, warnings, errors
   */
  pythonToJson(code) {
    return convertPythonToJson(code);
  }

  /**
   * Convert JSON rule to Python code
   * @param {Object|string} rule - JSON rule object or string
   * @param {string} format - Output format: 'expression', 'lambda', or 'function'
   * @returns {Object} Result with success, code, warnings, errors
   */
  jsonToPython(rule, format = 'expression') {
    // Parse if string
    if (typeof rule === 'string') {
      try {
        rule = JSON.parse(rule);
      } catch (e) {
        return {
          success: false,
          code: null,
          warnings: [],
          errors: [`Invalid JSON: ${e.message}`],
        };
      }
    }

    // Convert based on format
    let result;
    if (format === 'lambda') {
      result = convertJsonToLambda(rule);
    } else if (format === 'function') {
      result = convertJsonToFunction(rule);
    } else {
      result = convertJsonToPython(rule);
    }

    return result;
  }

  /**
   * Register a callback for when service is ready (always immediate for JS version)
   */
  onReady(callback) {
    callback();
  }
}

// Export singleton
export const converterService = new ConverterService();
export default converterService;

// Re-export conversion functions for direct use
export { convertJsonToPython, convertJsonToLambda, convertJsonToFunction, convertPythonToJson };
