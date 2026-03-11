/**
 * Parse, strip, and append tags in the format ## tagname
 * Tags are stored in the text and must be explicitly removed before publishing
 */

/**
 * Parse tags from text
 * @param {string} text - Text to parse
 * @returns {string[]} Array of tag names (without ##)
 */
export function parseTags(text) {
  const matches = text.match(/##\s+(\S+)/g) || [];
  return matches.map(tag => tag.replace(/##\s+/, ''));
}

/**
 * Strip all tags from text
 * @param {string} text - Text to clean
 * @returns {string} Text without tags, with collapsed empty lines
 */
export function stripTags(text) {
  // Remove all ## tag lines
  let cleaned = text.replace(/##\s+\S+/g, '');

  // Collapse multiple empty lines to single newline
  cleaned = cleaned.replace(/\n\n\n+/g, '\n\n');

  // Trim leading/trailing whitespace
  return cleaned.trim();
}

/**
 * Append tags to text
 * @param {string} text - Original text
 * @param {string[]} tags - Tags to append
 * @returns {string} Text with tags appended
 */
export function appendTags(text, tags = []) {
  if (!tags || tags.length === 0) {
    return text;
  }

  const tagString = tags.map(tag => `## ${tag}`).join(' ');
  return `${tagString}\n\n${text}`;
}
