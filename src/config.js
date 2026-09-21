// Storefront config sourced from Vite env vars (VITE_*). Changeable without code edits.

const rawNumber = (import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/[^\d]/g, '');
const greeting = import.meta.env.VITE_WHATSAPP_GREETING || 'Hi CaseVerse';

export const whatsapp = {
  number: rawNumber || null,
  /** Full wa.me link, or null if no number is configured. */
  link: rawNumber
    ? `https://wa.me/${rawNumber}?text=${encodeURIComponent(greeting)}`
    : null,
};

const email = (import.meta.env.VITE_CONTACT_EMAIL || '').trim();

/** Group " +977 98XXXXXXXX " out of a digits-only string for display. */
function formatPhone(digits) {
  if (!digits) return null;
  // Nepal numbers: 977 + 10 digits.
  if (digits.startsWith('977') && digits.length === 13) {
    return `+977 ${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return `+${digits}`;
}

export const contact = {
  /** mailto address, or null until VITE_CONTACT_EMAIL is set. */
  email: email || null,
  /** tel: href built from the WhatsApp number. */
  phoneTel: rawNumber ? `+${rawNumber}` : null,
  /** Human-readable phone for display. */
  phoneDisplay: formatPhone(rawNumber),
};
