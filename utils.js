/**
 * Security Utilities
 * Common functions for sanitization and security
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} unsafe - The potentially unsafe string
 * @returns {string} - The escaped string safe for HTML insertion
 */
function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates and sanitizes numeric input
 * @param {string|number} value - The value to validate
 * @param {number} defaultValue - Default value if invalid
 * @returns {number} - The validated number
 */
function sanitizeNumber(value, defaultValue = 0) {
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Validates and sanitizes date input
 * @param {string} dateString - The date string to validate
 * @returns {string|null} - The validated date string or null
 */
function sanitizeDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : dateString;
}

/**
 * Validates and sanitizes time input (HH:MM format)
 * @param {string} timeString - The time string to validate
 * @returns {string|null} - The validated time string or null
 */
function sanitizeTime(timeString) {
  if (!timeString) return null;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString) ? timeString : null;
}

/**
 * Sanitizes string input by trimming and limiting length
 * @param {string} str - The string to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - The sanitized string
 */
function sanitizeString(str, maxLength = 1000) {
  if (!str) return '';
  return String(str).trim().substring(0, maxLength);
}

/**
 * Creates a safe text node instead of using innerHTML
 * @param {string} text - The text to create a node for
 * @returns {Text} - A text node
 */
function createTextNode(text) {
  return document.createTextNode(text || '');
}

/**
 * Safely sets element text content
 * @param {HTMLElement} element - The element to update
 * @param {string} text - The text to set
 */
function setTextContent(element, text) {
  if (element) {
    element.textContent = text || '';
  }
}

/**
 * Validates URL to prevent javascript: and data: URLs
 * @param {string} url - The URL to validate
 * @returns {boolean} - Whether the URL is safe
 */
function isSafeUrl(url) {
  if (!url) return false;
  const urlLower = url.toLowerCase().trim();
  return !urlLower.startsWith('javascript:') &&
         !urlLower.startsWith('data:') &&
         !urlLower.startsWith('vbscript:');
}

// Make utilities available globally
window.SecurityUtils = {
  escapeHtml,
  sanitizeNumber,
  sanitizeDate,
  sanitizeTime,
  sanitizeString,
  createTextNode,
  setTextContent,
  isSafeUrl
};
