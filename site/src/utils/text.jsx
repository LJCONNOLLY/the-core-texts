function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wraps matches of `terms` in <mark>. `terms` is either a phrase string
 * (literal match, used for BookProfile's in-book search) or an array of
 * tokens (alternation match, used for ranked search results where the
 * snippet rarely contains the full literal query).
 */
export function highlightText(text, terms) {
  const list = Array.isArray(terms) ? terms.filter(Boolean) : [terms].filter(Boolean);
  if (list.length === 0) return text;

  const pattern = list.map(escapeRegex).join('|');
  const parts = text.split(new RegExp(`(${pattern})`, 'gi'));
  const lowerList = list.map(t => t.toLowerCase());

  return parts.map((part, i) =>
    lowerList.includes(part.toLowerCase())
      ? <mark key={i}>{part}</mark>
      : part
  );
}
