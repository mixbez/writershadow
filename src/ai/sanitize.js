// Placeholder - implemented in Step 11
export function detectInjection(text) {
  return false;
}

export function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function truncatePost(text, maxLen = 500) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}
