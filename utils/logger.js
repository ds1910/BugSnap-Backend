/**
 * =====================================================
 * CONSOLE LOG UTILITY
 * =====================================================
 * 
 * This utility provides consistent logging throughout the application
 * =====================================================
 */

const logger = {
  /**
   * Development logging
   */
  dev: (...args) => {
    console.log('[DEV]', ...args);
  },

  /**
   * Error logging (always active)
   * Critical errors should always be logged
   */
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },

  /**
   * Warning logging (always active)
   * Important warnings should always be logged
   */
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },

  /**
   * Info logging (production safe)
   * Important information that's safe for production
   */
  info: (...args) => {
    console.log('[INFO]', ...args);
  },

  /**
   * Debug logging
   * Detailed debugging information
   */
  debug: (...args) => {
    console.log('[DEBUG]', ...args);
  }
};

module.exports = logger;