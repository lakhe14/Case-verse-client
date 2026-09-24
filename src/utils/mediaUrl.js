// Product images uploaded through the admin are served by the API at
// /uploads/... . The storefront may live on another origin (Vercel vs the
// Render API), so those paths are resolved against VITE_API_URL. Everything
// else (bundled /assets/..., absolute URLs, blob: previews) is left as is.
const API_ORIGIN = import.meta.env.VITE_API_URL || '';

export function mediaUrl(url) {
  return typeof url === 'string' && url.startsWith('/uploads/') ? `${API_ORIGIN}${url}` : url;
}
