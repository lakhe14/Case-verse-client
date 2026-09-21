import { useEffect } from 'react';

const SUFFIX = 'CaseVerse';
const DEFAULT_DESCRIPTION =
  'CaseVerse is a small Nepal-based shop for iPhone covers. A tight, in-stock selection, shipped nationwide.';

function setMetaTag(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function usePageMeta(title, description, opts = {}) {
  useEffect(() => {
    const full = !title || title === SUFFIX ? SUFFIX : opts.raw ? title : `${title} | ${SUFFIX}`;
    document.title = full;
    setMetaTag('description', description || DEFAULT_DESCRIPTION);
  }, [title, description, opts.raw]);
}

export { DEFAULT_DESCRIPTION };
