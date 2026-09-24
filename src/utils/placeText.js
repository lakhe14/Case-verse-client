// Client copy of the server's place-name normalization (server/services/geo/normalize.js),
// used only to filter the already-loaded destination list while the server search runs
// or when it is unavailable.
const TOKEN_VARIANTS = { gaon: 'gaun', chok: 'chowk', chauk: 'chowk', bazaar: 'bazar', bajar: 'bazar', tole: 'tol', marga: 'marg', ktm: 'kathmandu' };

export function normalizePlace(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => TOKEN_VARIANTS[token] || token)
    .join(' ');
}

/** Destinations whose name, locality or district matches the text, best first. */
export function filterDestinations(destinations, query, limit = 8) {
  const norm = normalizePlace(query);
  if (!norm) return [];
  const packed = norm.replace(/ /g, '');
  const scored = [];
  for (const destination of destinations) {
    const fields = [destination.locality, destination.label, destination.name, destination.district].map(normalizePlace);
    const packedFields = fields.map((field) => field.replace(/ /g, ''));
    let score = 0;
    if (fields.includes(norm) || packedFields.includes(packed)) score = 3;
    else if (fields.some((field) => field.startsWith(norm) || field.includes(` ${norm}`)) || packedFields.some((field) => field.startsWith(packed))) score = 2;
    else if (packed.length >= 3 && packedFields.some((field) => field.includes(packed))) score = 1;
    if (score) scored.push({ destination, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || (a.destination.label || a.destination.name).localeCompare(b.destination.label || b.destination.name))
    .slice(0, limit)
    .map((item) => item.destination);
}
