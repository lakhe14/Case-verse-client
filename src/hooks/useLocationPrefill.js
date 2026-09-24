import { useCallback, useRef, useState } from 'react';
import { geo } from '../api/endpoints';

// Browser GeolocationPositionError codes.
const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

/**
 * "Use my location" for checkout. Asks for the position only when locate() is
 * called from a tap, sends it once to our own API (which rounds it and looks up
 * the address server-side) and keeps nothing: the position is a local variable
 * of this call, never state, storage or part of the order.
 *
 * status: idle | detecting | detected | denied | unavailable | timeout | failed
 */
export default function useLocationPrefill() {
  const [status, setStatus] = useState('idle');
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);
  const attempt = useRef(0);

  const locate = useCallback(() => new Promise((resolve) => {
    const id = ++attempt.current;
    const settle = (nextStatus, result = null, message = null) => {
      if (attempt.current !== id) return resolve(null);
      setStatus(nextStatus);
      setAddress(result);
      setError(message);
      return resolve(result);
    };
    if (!window.isSecureContext || !navigator.geolocation) {
      settle('unavailable');
      return;
    }
    setStatus('detecting');
    setAddress(null);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        geo.reverse(position.coords.latitude, position.coords.longitude)
          .then((response) => settle('detected', response.data))
          .catch((e) => settle('failed', null, e.message));
      },
      (positionError) => {
        if (positionError.code === PERMISSION_DENIED) settle('denied');
        else if (positionError.code === TIMEOUT) settle('timeout');
        else settle('unavailable');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }), []);

  return { status, address, error, locate };
}

/** The Area / Street text built from a looked-up address (locality, street, ward). */
export function areaFromAddress(address) {
  if (!address) return '';
  const parts = [address.locality, address.street, address.ward ? `Ward ${address.ward}` : null].filter(Boolean);
  return [...new Set(parts)].join(', ');
}
