import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';

export default function NotFound() {
  usePageMeta('Page not found', 'The page you were looking for could not be found.');
  return (
    <div className="center" style={{ padding: '72px 20px 96px' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', color: 'var(--brass)', margin: 0 }}>
        404
      </p>
      <h1 style={{ marginTop: 10 }}>We can't find that page</h1>
      <p className="muted" style={{ maxWidth: '42ch', margin: '0 auto 22px' }}>
        The link may be old or the page may have moved. Everything we stock is a click away.
      </p>
      <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
        <Link to="/" className="btn">Back to home</Link>
        <Link to="/shop" className="btn subtle">Browse the shop</Link>
      </div>
    </div>
  );
}
