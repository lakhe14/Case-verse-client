/**
 * Collects essential browser failures for a page: uncaught page errors,
 * unexpected console errors, local API/asset responses >= 400 and failed
 * local requests. Security and resilience tests that *expect* a 4xx/5xx or an
 * aborted request must list it in `allow`, so nothing is ignored globally.
 *
 * allow: [{ url: RegExp, status?: number | number[], network?: boolean }]
 */
const LOCAL_ORIGINS = ['http://localhost:5173/', 'http://127.0.0.1:4002/'];

function isAllowed(allow, url, { status, network = false }) {
  return allow.some((rule) => {
    if (!rule.url.test(url)) return false;
    if (network) return Boolean(rule.network);
    if (rule.status === undefined) return false;
    return Array.isArray(rule.status) ? rule.status.includes(status) : rule.status === status;
  });
}

export function essentialFailures(page, { allow = [] } = {}) {
  const failures = [];
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // Google Fonts is cosmetic and intentionally blocked in the restricted
    // local browser environment. Local API/image failures still fail below.
    if (text.includes('net::ERR_NETWORK_ACCESS_DENIED')) return;
    // The browser also logs each expected (allow-listed) failed response.
    const url = message.location()?.url || '';
    if (/^Failed to load resource/.test(text) && allow.some((rule) => rule.url.test(url))) return;
    failures.push(`console: ${text}`);
  });
  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    if (status < 400 || !(url.includes('/api/') || url.includes('/assets/'))) return;
    if (isAllowed(allow, url, { status })) return;
    failures.push(`HTTP ${status}: ${url}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!LOCAL_ORIGINS.some((origin) => url.startsWith(origin))) return;
    if (isAllowed(allow, url, { network: true })) return;
    failures.push(`network: ${request.failure()?.errorText || 'request failed'}: ${url}`);
  });
  return failures;
}

/** Text that must never reach a customer: stack traces, driver or provider internals. */
export const LEAK_PATTERN = /\bat \S+ \(.+:\d+:\d+\)|Sequelize|\bER_[A-Z_]{3,}|ECONNREFUSED|ETIMEDOUT|SELECT .+ FROM|TypeError|ReferenceError|PARCELMOOVER_[A-Z_]+|internal_error/;

export async function expectNoLeakedInternals(page, expect) {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(LEAK_PATTERN);
}
