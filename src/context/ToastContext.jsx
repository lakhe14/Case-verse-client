import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

let seq = 0;
const EXIT_MS = 170;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  // Two-phase: mark the toast leaving so it can animate out, then remove it.
  const dismiss = useCallback(
    (id) => {
      setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      const timer = timers.current.get(id);
      if (timer) clearTimeout(timer);
      timers.current.set(id, setTimeout(() => remove(id), EXIT_MS));
    },
    [remove]
  );

  const push = useCallback(
    (type, message, { duration = 4500, action } = {}) => {
      if (!message) return;
      const id = ++seq;
      setToasts((list) => [...list, { id, type, message, action }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, { duration: 6000, ...o }),
    info: (m, o) => push('info', m, o),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type} ${t.leaving ? 'is-leaving' : ''}`}>
            <div className="toast-body">
              <span>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    t.action.onClick?.();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
