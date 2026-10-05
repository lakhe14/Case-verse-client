import { useEffect, useRef } from 'react';

const focusable = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Staff-only proof viewer. Blob URLs are supplied by the authenticated caller. */
export default function PaymentProofModal({ src, onClose, returnFocus }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...dialogRef.current.querySelectorAll(focusable)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      (returnFocus?.current || previous)?.focus?.();
    };
  }, [onClose, returnFocus]);

  return (
    <div className="admin-proof-modal" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="admin-proof-modal__dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="payment-proof-title">
        <div className="admin-proof-modal__head">
          <h2 id="payment-proof-title">Payment proof preview</h2>
          <button ref={closeRef} type="button" className="btn ghost sm" aria-label="Close payment proof preview" onClick={onClose}>Close</button>
        </div>
        <img src={src} alt="Customer payment proof" />
      </div>
    </div>
  );
}
