/** Small presentational primitives shared across pages. */

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function ErrorText({ error }) {
  if (!error) return null;
  return (
    <div className="alert error">
      {error.message || String(error)}
      {Array.isArray(error.details) && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {error.details.map((d, i) => (
            <li key={i}>
              {d.path ? `${d.path}: ` : ''}
              {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="center muted" style={{ padding: '56px 20px' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--ink)' }}>{title}</p>
      {children}
    </div>
  );
}

const CURRENCY = (typeof localStorage !== 'undefined' && localStorage.getItem('cv_currency')) || 'NPR';

export function Money({ value, serif = false }) {
  const n = Number(value || 0);
  return (
    <span className={serif ? 'money-serif' : 'money'}>
      {CURRENCY} {n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export function Stars({ value = 0 }) {
  const full = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {'★★★★★'.slice(0, full)}
      <span className="empty">{'★★★★★'.slice(full)}</span>
    </span>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="row" style={{ justifyContent: 'center', marginTop: 32 }}>
      <button className="btn subtle sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span className="muted small" style={{ alignSelf: 'center' }}>
        Page {page} of {pages}
      </span>
      <button className="btn subtle sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function QuantityStepper({ value, min = 1, max = 99, onChange }) {
  return (
    <div className="qty">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="qty-n">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
