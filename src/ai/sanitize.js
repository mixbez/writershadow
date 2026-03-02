const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|previous\s+|above\s+)?instructions/gi,
  /you\s+are\s+now/gi,
  /forget\s+(everything|all|your\s+instructions)/gi,
  /\bsystem\s*prompt\b/gi,
  /\bnew\s+instructions?\b/gi,
  /\bpretend\s+(you|to\s+be)\b/gi,
  /\bact\s+as\b/gi,
  /\bjailbreak\b/gi,
  /\bdan\b.*mode/gi,
];

export function detectInjection(text) {
  return INJECTION_PATTERNS.some((p) => p.test(text));
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
