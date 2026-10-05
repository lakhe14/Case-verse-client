import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '../api/endpoints';
import { useToast } from '../context/ToastContext';

const POLL_MS = 30_000;
const time = (value) => new Date(value).toLocaleString();

export default function AdminNotifications({ onUnreadChange }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const knownIds = useRef(null);
  const inFlight = useRef(false);
  const bell = useRef(null);

  const refresh = useCallback(async () => {
    if (inFlight.current || document.hidden) return;
    inFlight.current = true;
    try {
      const result = await admin.notifications({ limit: 30 });
      const next = result.data || [];
      const ids = new Set(next.map((item) => item.id));
      if (knownIds.current) {
        next.filter((item) => !knownIds.current.has(item.id)).forEach((item) => {
          toast.info(`New order received: ${item.message}`, { action: { label: 'View order', onClick: () => openNotification(item) } });
        });
      }
      knownIds.current = ids;
      setItems(next);
      onUnreadChange(result.unread_count || 0);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  // openNotification is stable enough in practice; it reads no state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUnreadChange, toast]);

  useEffect(() => {
    refresh(); // This first response is the session baseline: no historical toasts.
    const interval = setInterval(refresh, POLL_MS);
    const visibility = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', visibility); };
  }, [refresh]);

  useEffect(() => {
    if (!open) return undefined;
    const key = (event) => { if (event.key === 'Escape') { setOpen(false); bell.current?.focus(); } };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open]);

  const openNotification = async (item) => {
    if (!item.read_at) {
      try {
        await admin.markNotificationRead(item.id);
        setItems((current) => current.map((n) => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n));
        onUnreadChange((count) => Math.max(0, count - 1));
      } catch (err) { toast.error(err.message || 'Could not mark notification as read.'); }
    }
    setOpen(false);
    if (item.order_id) navigate(`/admin/orders/${item.order_id}`);
  };

  const markAll = async () => {
    try {
      await admin.markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      onUnreadChange(0);
    } catch (err) { toast.error(err.message || 'Could not mark notifications as read.'); }
  };

  const unread = items.filter((item) => !item.read_at).length;
  return <div className="admin-notifications">
    <button ref={bell} type="button" className="admin-bell" aria-label={unread ? `${unread} unread order notifications` : 'Order notifications'} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true">♢</span>{unread > 0 && <b aria-hidden="true">{unread > 99 ? '99+' : unread}</b>}
    </button>
    {open && <section className="admin-notification-panel" aria-label="Order notifications">
      <div className="spread"><strong>Notifications</strong><button className="btn ghost sm" type="button" disabled={!unread} onClick={markAll}>Mark all read</button></div>
      {loading && <p className="muted small">Loading notifications…</p>}
      {error && <p className="alert error">Could not load notifications. <button className="linklike" type="button" onClick={refresh}>Retry</button></p>}
      {!loading && !error && !items.length && <p className="muted small">No new-order notifications.</p>}
      {!error && items.map((item) => <button className={`admin-notification-row ${item.read_at ? '' : 'is-unread'}`} type="button" key={item.id} onClick={() => openNotification(item)}><strong>{item.title}</strong><span>{item.message}</span>{item.customer_label && <small>{item.customer_label}</small>}<small>{time(item.created_at)}</small></button>)}
    </section>}
  </div>;
}
