/**
 * Opaque, high-entropy key for one checkout submission (Idempotency-Key header).
 * randomUUID needs a secure context; getRandomValues works everywhere.
 */
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
